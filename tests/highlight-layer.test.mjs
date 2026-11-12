import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Raycaster, Vector3 } from 'three';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const helperUrl = moduleUrl(await readFile(new URL('../src/components/globeHighlights.ts', import.meta.url), 'utf8'));
const { uniqueBoundarySegments } = await import(helperUrl);
const layerSource = (await readFile(new URL('../src/components/HighlightLayer.ts', import.meta.url), 'utf8'))
  .replaceAll("from './globeHighlights'", `from '${helperUrl}'`)
  .replace(/from '(three(?:\/[^']+)?|three-conic-polygon-geometry)'/g, (_, name) => `from '${import.meta.resolve(name)}'`);
// The browser geometry package checks window.THREE when it is first imported.
globalThis.window = {};
const { HighlightLayer } = await import(moduleUrl(layerSource)).finally(() => { delete globalThis.window; });

const countries = new Map([[1, { code: 'AA' }], [2, { code: 'BB' }]]);
const square = (id, left, right) => ({ id, geometry: { type: 'Polygon', coordinates: [
  [[left, 0], [left, 1], [right, 1], [right, 0], [left, 0]],
] } });

test('shared boundaries render once, including reversed edges and dateline aliases', () => {
  const segments = uniqueBoundarySegments([square(1, 0, 1), square(2, 1, 2)], countries);
  assert.equal(segments.length, 7);
  assert.equal(segments.filter(s => s.owners.size === 2).length, 1);
  assert.equal(uniqueBoundarySegments([square(1, 179, 180), square(2, -180, -179)], countries).length, 7);
});

test('zoom and selection reuse geometry and preserve surface detail', () => {
  const features = [square(1, 0, 1), square(2, 1, 2)];
  const layer = new HighlightLayer(features, countries);
  const geometry = layer.geometry;
  const positions = geometry.attributes.instanceStart.data.array;
  const fill = layer.children.find(child => child.material?.uniforms?.selectedRegion);
  assert.ok(fill);
  assert.equal(layer.children.length, 4, 'one visible fill mesh and three shared line passes');
  const first = layer.pickerFor(features[0]);
  const second = layer.pickerFor(features[1]);
  assert.notEqual(first, second);
  assert.equal(first.material.visible, false);
  const lng = 0.5 * Math.PI / 180, lat = 0.5 * Math.PI / 180;
  const direction = new Vector3(Math.sin(lng) * Math.cos(lat), Math.sin(lat), Math.cos(lng) * Math.cos(lat));
  const ray = new Raycaster(direction.clone().multiplyScalar(300), direction.clone().negate());
  assert.ok(ray.intersectObject(first).length, 'non-rendering picker still has a ray intersection');
  assert.equal(ray.intersectObject(second).length, 0);
  layer.setSelection('AA');
  assert.equal(fill.material.uniforms.selectedRegion.value, first.geometry.getAttribute('highlightRegion').getX(0));
  assert.notEqual(fill.material.uniforms.selectedRegion.value, second.geometry.getAttribute('highlightRegion').getX(0));
  layer.setZoom(0.25);
  const closeWidth = layer.materials[2].linewidth;
  layer.setZoom(2.4);
  assert.ok(layer.materials[2].linewidth < closeWidth);
  assert.equal(layer.geometry, geometry);
  assert.equal(geometry.attributes.instanceStart.data.array, positions);
  assert.ok(layer.children.includes(fill));
  assert.equal(fill.material.depthWrite, false);
  for (const material of layer.materials) {
    assert.equal(material.depthTest, true, 'far-side borders stay behind the opaque globe');
    assert.equal(material.depthWrite, false);
  }
  layer.setSelection(null);
  assert.equal(fill.material.uniforms.selectedRegion.value, 0);
  let disposed = false;
  geometry.addEventListener('dispose', () => { disposed = true; });
  layer.dispose();
  assert.ok(disposed);
});
