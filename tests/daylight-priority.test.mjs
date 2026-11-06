import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { PerspectiveCamera, Vector3 } from 'three';
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)
  .replaceAll("from 'three'", `from '${import.meta.resolve('three')}'`)).toString('base64')}`;
const planUrl = url(await readFile(new URL('../src/components/countryTilePlan.ts', import.meta.url), 'utf8'));
const { TilePriority } = await import(url((await readFile(new URL('../src/components/TilePriority.ts', import.meta.url), 'utf8'))
  .replace("from './countryTilePlan'", `from '${planUrl}'`)));
const { TileImageCache } = await import(url((await readFile(new URL('../src/components/TileImageCache.ts', import.meta.url), 'utf8'))
  .replace("from './countryTilePlan'", `from '${planUrl}'`)));
const tile = lng => ({ x: Math.floor((lng + 180) / 360 * 16), y: 7, level: 4 });
const jpeg = () => new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' });

test('visible daylight > twilight > night > offscreen daylight, with selected night destinations protected', () => {
  const camera = new PerspectiveCamera(50, 2, 0.1, 2000);
  camera.position.set(0, 0, 340); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const priority = new TilePriority();
  const day = tile(45), twilight = tile(-11), night = tile(-60), offscreen = tile(135);
  priority.update(camera, new Vector3(1, 0, 0), [], true);
  assert.ok(priority.rank(day) > priority.rank(twilight));
  assert.ok(priority.rank(twilight) > priority.rank(night));
  assert.ok(priority.rank(night) > priority.rank(offscreen));
  priority.update(camera, new Vector3(1, 0, 0), [night], true);
  assert.ok(priority.rank(night) > priority.rank(day), 'a clicked night country is not starved by other daylight areas');
  priority.update(camera, new Vector3(-1, 0, 0), [], true);
  assert.ok(priority.rank(night) > priority.rank(day), 'sun changes update ranking without clearing imagery');
});

test('foreground promotes a paused prefetch and shares one fetch and decode', async () => {
  const original = globalThis.fetch;
  let requests = 0, decodes = 0;
  globalThis.fetch = async () => { requests++; return new Response(jpeg()); };
  const cache = new TileImageCache();
  cache.configure({ paused: () => true });
  try {
    const address = tile(45);
    const background = cache.load(address, 'network', false);
    const foreground = cache.load(address, 'network', true);
    assert.equal(background, foreground);
    const decode = async () => { decodes++; await new Promise(resolve => setTimeout(resolve, 5)); return { pixels: true }; };
    const a = cache.decode(address, 'network', decode), b = cache.decode(address, 'network', decode);
    assert.equal(a, b);
    assert.equal(await a, await b);
    await background;
    assert.equal(requests, 1);
    assert.equal(decodes, 1);
  } finally { cache.dispose(); globalThis.fetch = original; }
});

test('foreground requests use daylight ranking and reserve capacity over background work', async () => {
  const original = globalThis.fetch, order = [];
  const cache = new TileImageCache();
  cache.configure({ score: address => address.x }, 1);
  globalThis.fetch = async source => { order.push(source); return new Response(jpeg()); };
  try {
    const low = cache.load({ x: 1, y: 0, level: 4 }, 'night');
    const high = cache.load({ x: 9, y: 0, level: 4 }, 'day');
    await Promise.all([low, high]);
    assert.deepEqual(order, ['day', 'night']);
  } finally { cache.dispose(); globalThis.fetch = original; }
});
