import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Vector3 } from 'three';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const helperUrl = moduleUrl(await readFile(new URL('../src/components/globeHighlights.ts', import.meta.url), 'utf8'));
const { uniqueBoundarySegments } = await import(helperUrl);
const layerSource = (await readFile(new URL('../src/components/HighlightLayer.ts', import.meta.url), 'utf8'))
  .replaceAll("from './globeHighlights'", `from '${helperUrl}'`)
  .replace(/from '(three(?:\/[^']+)?)'/g, (_, name) => `from '${import.meta.resolve(name)}'`);
const { HighlightLayer } = await import(moduleUrl(layerSource));

const countries = new Map([[1, { code: 'AA' }], [2, { code: 'BB' }]]);
const square = (id, left, right) => ({ id, geometry: { type: 'Polygon', coordinates: [
  [[left, 0], [right, 0], [right, 1], [left, 1], [left, 0]],
] } });

test('shared boundaries render once, including reversed edges and dateline aliases', () => {
  const segments = uniqueBoundarySegments([square(1, 0, 1), square(2, 1, 2)], countries);
  assert.equal(segments.length, 7);
  assert.equal(segments.filter(s => s.owners.size === 2).length, 1);
  assert.equal(uniqueBoundarySegments([square(1, 179, 180), square(2, -180, -179)], countries).length, 7);
});

test('zoom and selection reuse geometry, preserve surface detail, and share live sunlight', () => {
  const features = [square(1, 0, 1), square(2, 1, 2)];
  const sun = new Vector3(1, 0, 0);
  const layer = new HighlightLayer(features, countries, sun);
  const geometry = layer.geometry;
  const positions = geometry.attributes.instanceStart.data.array;
  const fill = layer.fillMaterial(features[0]);
  layer.setSelection('AA');
  assert.equal(fill.uniforms.selected.value, 1);
  layer.setZoom(0.25);
  const closeWidth = layer.materials[2].linewidth;
  layer.setZoom(2.4);
  assert.ok(layer.materials[2].linewidth < closeWidth);
  assert.equal(layer.geometry, geometry);
  assert.equal(geometry.attributes.instanceStart.data.array, positions);
  assert.equal(layer.fillMaterial(features[0]), fill);
  assert.equal(fill.depthWrite, false);
  assert.ok(fill.fragmentShader.includes('daylight'));
  for (const material of layer.materials) {
    assert.equal(material.depthTest, true, 'far-side borders stay behind the opaque globe');
    assert.equal(material.depthWrite, false);
    assert.equal(material.uniforms.sunDir.value, sun);
  }
  layer.setSelection(null);
  assert.equal(fill.uniforms.selected.value, 0);
  let disposed = false;
  geometry.addEventListener('dispose', () => { disposed = true; });
  layer.dispose();
  assert.ok(disposed);
});
