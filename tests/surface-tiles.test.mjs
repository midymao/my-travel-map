import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Mesh, MeshBasicMaterial, SphereGeometry, Texture, Vector3, PerspectiveCamera } from 'three';

// Run the browser-independent tile lifecycle with a deterministic frame clock.
// Absolute imports allow TypeScript modules to run from data URLs without a
// bundler, browser, network connection, or generated test files.
function moduleUrl(source) {
  const js = stripTypeScriptTypes(source).replace(
    /from '((?:three|three-slippy-map-globe))'/g,
    (_, name) => `from '${import.meta.resolve(name)}'`,
  );
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const surfaceUrl = moduleUrl(await readFile(new URL('../src/components/earthSurface.ts', import.meta.url), 'utf8'));
const vendorUrl = `data:text/javascript;base64,${Buffer.from((await readFile(new URL('../src/components/vendor/CachedSlippyMapGlobe.js', import.meta.url), 'utf8'))
  .replace(/from '([^./][^']*)'/g, (_, name) => `from '${import.meta.resolve(name)}'`)).toString('base64')}`;
const tileSource = (await readFile(new URL('../src/components/SurfaceTiles.ts', import.meta.url), 'utf8'))
  .replace("from './vendor/CachedSlippyMapGlobe.js'", `from '${vendorUrl}'`)
  .replace("from './earthSurface'", `from '${surfaceUrl}'`);
const { SurfaceTiles } = await import(moduleUrl(tileSource));
const { TileViewCache } = await import(moduleUrl(
  await readFile(new URL('../src/components/TileViewCache.ts', import.meta.url), 'utf8'),
));

test('Turkey → Fiji → Turkey reuses the same resident view without disposing or rebuilding it', () => {
  const created = [];
  const cache = new TileViewCache(key => {
    const view = {
      key, visible: false, residentTileCount: 20, disposed: false,
      texture: {}, material: {}, fadeProgress: 1,
      resumeUploads() {}, dispose() { this.disposed = true; },
    };
    created.push(view);
    return view;
  }, 2, 100);
  const turkey = cache.activate('country:TR');
  const fiji = cache.activate('country:FJ');
  assert.equal(turkey.visible, false);
  assert.equal(fiji.visible, true);
  const returned = cache.activate('country:TR');
  assert.equal(returned, turkey, 'reuse the full engine, not just image downloads');
  assert.equal(returned.texture, turkey.texture);
  assert.equal(returned.material, turkey.material);
  assert.equal(returned.fadeProgress, 1, 'no fresh fade-in state');
  assert.equal(created.length, 2);
  assert.equal(cache.hits, 1);
  assert.equal(turkey.disposed, false);
  cache.hide(); // Return to overview.
  assert.equal(cache.activate('country:TR'), turkey);
  assert.equal(cache.hits, 2);
  cache.activate('city:TR:istanbul');
  assert.equal(fiji.disposed, true, 'evict the least recently used inactive view');
  assert.equal(turkey.disposed, false);
  assert.equal(cache.size, 2);
});

test('tile budget evicts inactive views as late image callbacks grow residency', () => {
  const cache = new TileViewCache(() => ({
    visible: false, residentTileCount: 10, disposed: false,
    resumeUploads() {}, dispose() { this.disposed = true; },
  }), 6, 100);
  const old = cache.activate('old');
  const current = cache.activate('current');
  current.residentTileCount = 95;
  cache.trim();
  assert.equal(old.disposed, true);
  assert.equal(current.disposed, false);
  assert.equal(cache.residentTiles, 95);
  current.residentTileCount = 110;
  cache.trim();
  assert.equal(current.disposed, false, 'never evict the visible view');
  cache.hide();
  cache.trim();
  assert.equal(current.disposed, false, 'overview alone must not erase the most recent oversized view');
  assert.equal(cache.activate('current'), current);
});

test('tile uploads pause during motion, fade in with ordered depth, and do not resurrect disposed tiles', () => {
  const frames = new Map();
  let frameId = 0;
  const oldRequest = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const frame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(performance.now()));
  };
  let moving = true;
  const tiles = new SurfaceTiles(100.06, {
    day: new Texture(), night: new Texture(), sun: new Vector3(1, 0, 0),
    anisotropy: 4, order: -70, reduceMotion: false, canUpload: () => !moving,
  }, {});
  const tile = level => new Mesh(
    new SphereGeometry(100.06, 2, 2, 0, 2 * Math.PI / 2 ** level),
    new MeshBasicMaterial({ map: new Texture() }),
  );
  try {
    const low = tile(5), high = tile(8), third = tile(8);
    tiles.add(low, high, third);
    frame();
    assert.equal(tiles.children.includes(low), false, 'no GPU upload during motion');
    moving = false;
    frame();
    assert.equal(tiles.children.includes(low), true);
    assert.equal(tiles.children.includes(high), true);
    assert.equal(tiles.children.includes(third), false, 'at most two uploads per frame');
    assert.equal(high.material.depthWrite, false);
    assert.equal(high.material.transparent, true);
    assert.ok(high.renderOrder > low.renderOrder, 'fine tiles draw after coarse tiles');
    assert.ok(high.renderOrder < 0, 'country outlines draw after imagery');
    high.onBeforeRender();
    assert.equal(high.material.uniforms.surfaceOpacity.value, 0, 'first frame fades from existing imagery');
    high.material.depthWrite = true; // Simulate the dependency's LOD setter.
    tiles.updatePov(new PerspectiveCamera());
    assert.equal(high.material.depthWrite, false, 'LOD updates cannot restore depth fighting');
    frame();
    assert.equal(tiles.children.includes(third), true);

    const stale = tile(9);
    tiles.add(stale);
    stale.geometry.dispose();
    frame();
    assert.equal(tiles.children.includes(stale), false, 'disposed in-flight tiles stay removed');

    const cleared = tile(9);
    tiles.add(cleared);
    tiles.clearTiles();
    frame();
    assert.equal(tiles.children.includes(cleared), false, 'clearing cancels queued uploads');
  } finally {
    globalThis.requestAnimationFrame = oldRequest;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});

test('tile engine uses the shared async loader, retries failures, and drops late results after disposal', async () => {
  const originalRequest = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame;
  const originalNow = Date.now;
  const frames = new Map(); let nextFrame = 0, now = 10000, attempts = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  Date.now = () => now;
  let fail = true, release;
  const tiles = new SurfaceTiles(100.06, {
    day: new Texture(), night: new Texture(), sun: new Vector3(1, 0, 0),
    anisotropy: 4, order: -70, reduceMotion: true, canUpload: () => true,
    loadImage: async () => {
      attempts++;
      if (fail) throw new Error('temporary image failure');
      return new Promise(resolve => { release = () => resolve({ width: 256, height: 256 }); });
    },
  }, { minLevel: 0, maxLevel: 0, tileUrl: () => 'shared-cache' });
  const camera = new PerspectiveCamera(50, 2, 0.1, 2000);
  camera.position.set(0, 0, 340); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  try {
    tiles.updatePov(camera);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(attempts, 1);
    tiles.updatePov(camera);
    assert.equal(attempts, 1, 'failed requests have a retry delay');
    now += 6000; fail = false;
    tiles.updatePov(camera);
    assert.equal(attempts, 2);
    tiles.dispose();
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(tiles.residentTileCount, 0, 'late textures cannot resurrect a disposed view');
    assert.equal(tiles.children.length, 0);
  } finally {
    tiles.dispose(); Date.now = originalNow;
    globalThis.requestAnimationFrame = originalRequest; globalThis.cancelAnimationFrame = originalCancel;
  }
});
