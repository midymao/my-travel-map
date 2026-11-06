import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { PerspectiveCamera, Vector3 } from 'three';
import SlippyMapGlobe from 'three-slippy-map-globe';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)
  .replaceAll("from 'three'", `from '${import.meta.resolve('three')}'`)).toString('base64')}`;
const planUrl = moduleUrl(await readFile(new URL('../src/components/countryTilePlan.ts', import.meta.url), 'utf8'));
const { countryTilePlan, overviewTilePlan, tileKey } = await import(planUrl);
const { TileImageCache } = await import(moduleUrl((await readFile(new URL('../src/components/TileImageCache.ts', import.meta.url), 'utf8'))
  .replace("from './countryTilePlan'", `from '${planUrl}'`)));
const imageBlob = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1])], { type: 'image/jpeg' });

test('country plans cover actual renderer requests at default views, including Fiji and high latitudes', () => {
  const originalDocument = globalThis.document;
  // Capture actual dependency requests without decoding or allocating textures.
  globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {} }) };
  try {
    for (const coarse of [false, true]) {
      for (const view of [
        { lat: 42, lng: 12, altitude: 0.3 },
        { lat: -17.8, lng: 178, altitude: 0.4 },
        { lat: 60, lng: 30, altitude: 0.22 },
        { lat: 3, lng: 102, altitude: 0.8 },
      ]) {
        const camera = new PerspectiveCamera(50, 1.9, 0.1, 2000);
        const lat = view.lat * Math.PI / 180, lng = view.lng * Math.PI / 180;
        camera.position.copy(new Vector3(Math.cos(lat) * Math.sin(lng), Math.sin(lat), Math.cos(lat) * Math.cos(lng))
          .multiplyScalar(100 * (1 + view.altitude)));
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        const planned = new Set(countryTilePlan(view, camera, coarse).map(tileKey));
        const requested = [];
        const engine = new SlippyMapGlobe(100.06, { tileUrl: (x, y, level) => {
          requested.push(tileKey({ x, y, level })); return `https://example.com/${level}/${y}/${x}`;
        } });
        engine.thresholds = Array.from({ length: 24 }, (_, i) => (coarse ? 16 : 32) / 2 ** i);
        engine.updatePov(camera);
        assert.ok(requested.length > 0);
        assert.ok(requested.every(key => planned.has(key)), `Missing renderer tile for ${JSON.stringify(view)}`);
        engine.clearTiles();
        for (const mesh of engine.children) { mesh.geometry?.dispose(); mesh.material?.dispose(); }
      }
    }
  } finally { globalThis.document = originalDocument; }
  assert.equal(overviewTilePlan(4).length, 256);
  assert.equal(countryTilePlan({ lat: 35, lng: 104, altitude: 1.5 }, new PerspectiveCamera(), false).length, 0,
    'wide country views share the initial overview instead of downloading redundant detail');
});

test('compressed country cache deduplicates, persists across visits, and does not rely on GPU residency', async () => {
  const originals = { fetch: globalThis.fetch, caches: globalThis.caches, createImageBitmap: globalThis.createImageBitmap };
  const disk = new Map();
  let requests = 0, active = 0, peak = 0;
  globalThis.caches = { open: async () => ({
    keys: async () => [...disk.keys()], delete: async key => disk.delete(key),
    match: async key => disk.get(key)?.clone(), put: async (key, response) => disk.set(key, response),
  }) };
  globalThis.createImageBitmap = async () => ({ close() {} });
  globalThis.fetch = async () => {
    requests++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return new Response(imageBlob());
  };
  const first = new TileImageCache(), second = new TileImageCache();
  try {
    const tiles = overviewTilePlan(1);
    const progress = [];
    await first.open();
    const result = await first.preload([...tiles, ...tiles], () => 'https://example.com/tile', p => progress.push(p), new AbortController().signal, 2);
    assert.equal(result.complete, true);
    assert.equal(result.total, 4);
    assert.equal(requests, 4);
    assert.equal(peak, 2, 'bound background concurrency');
    assert.equal(first.has(tiles[0]), true);
    assert.equal(progress.at(-1).done, 4);
    first.dispose(); // GPU eviction / full reload must not discard persistent imagery.
    await second.open();
    await second.preload(tiles, () => 'network', () => {}, new AbortController().signal);
    assert.equal(requests, 4, 'next visit reads persistent images without network requests');
    assert.equal(await (await second.load(tiles[0], 'network')).arrayBuffer().then(b => b.byteLength), 6);
  } finally {
    first.dispose(); second.dispose(); Object.assign(globalThis, originals);
  }
});

test('failed and cancelled preloads settle without trapping the homepage', async () => {
  const originals = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap };
  globalThis.fetch = async () => new Response('offline', { status: 503 });
  const cache = new TileImageCache();
  try {
    const failed = await cache.preload(overviewTilePlan(3), () => 'network', () => {}, new AbortController().signal, 1);
    assert.equal(failed.complete, false);
    assert.equal(failed.failed, 12, 'stop after repeated failures rather than trying every country');
    const cancelled = new AbortController(); cancelled.abort();
    const result = await cache.preload(overviewTilePlan(3), () => 'network', () => {}, cancelled.signal);
    assert.equal(result.done, 0);
    assert.equal(result.complete, false);
    assert.equal(cache.has({ x: 0, y: 0, level: 3 }), false);
  } finally { cache.dispose(); Object.assign(globalThis, originals); }
});

test('background work pauses during interaction and follows changing country priority', async () => {
  const originals = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap };
  let paused = true, bitmapCount = 0;
  const requests = [];
  const tiles = overviewTilePlan(1);
  let priority = [tiles[3]];
  let releaseFirst;
  globalThis.createImageBitmap = async () => { bitmapCount++; return { close() {} }; };
  globalThis.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) {
      paused = true;
      await new Promise(resolve => { releaseFirst = resolve; });
    }
    return new Response(imageBlob());
  };
  const cache = new TileImageCache();
  const abort = new AbortController();
  try {
    const job = cache.preload(tiles, tileKey, () => {}, abort.signal, 1, {
      paused: () => paused, priority: () => priority,
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(requests.length, 0, 'no background downloads while manipulating the map');
    paused = false;
    while (!releaseFirst) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(requests[0], tileKey(tiles[3]), 'clicked country is requested ahead of the original queue');
    releaseFirst();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(bitmapCount, 0, 'defer decoding if interaction starts during a download');
    assert.equal(requests.length, 1, 'do not start the next tile while paused');
    priority = [tiles[2]];
    paused = false;
    const result = await job;
    assert.equal(result.complete, true);
    assert.equal(requests[1], tileKey(tiles[2]), 'country priority can change while the queue is running');
    assert.equal(bitmapCount, 0, 'background images are never decoded until displayed');
  } finally { abort.abort(); cache.dispose(); Object.assign(globalThis, originals); }
});
