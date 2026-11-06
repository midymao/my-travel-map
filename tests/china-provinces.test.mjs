import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { geoArea, geoContains } from 'd3-geo';

const collection = JSON.parse(await readFile(new URL('../public/data/china-provinces.geo.json', import.meta.url), 'utf8'));
const source = stripTypeScriptTypes(await readFile(new URL('../src/components/globeHighlights.ts', import.meta.url), 'utf8'));
const { buildHighlightPolygons, highlightCountryCode, clickableCountryCode } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`,
);

test('only the requested 18 provinces are highlighted, with valid local spherical polygons', () => {
  const expected = ['330000', '310000', '320000', '370000', '120000', '110000',
    '130000', '210000', '140000', '610000', '620000', '630000', '540000',
    '510000', '410000', '420000', '440000', '810000'];
  assert.deepEqual(collection.features.map(f => f.properties.code), expected);
  for (const f of collection.features) {
    assert.ok(geoArea(f) > 0 && geoArea(f) < 0.5, `${f.properties.name}: local area, not its spherical complement`);
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && lng > 70 && lng < 136 && lat > 18 && lat < 55));
    }
  }
  for (const point of [[0, 0], [139.7, 35.7], [112.94, 28.23], [106.55, 29.56]]) {
    assert.ok(!collection.features.some(f => geoContains(f, point)), `unvisited location ${point} must stay unfilled`);
  }
  assert.ok(geoContains(collection.features.find(f => f.properties.code === '330000'), [120.155, 30.274]));
  assert.ok(geoContains(collection.features.find(f => f.properties.code === '810000'), [114.169, 22.319]));
});

test('China national outline stays excluded and province polygons cannot open country/city UI', () => {
  const countryMap = new Map([[156, { code: 'CN', drawBoundary: true }], [792, { code: 'TR' }]]);
  const china = { id: '156', properties: { name: 'China' } };
  const turkey = { id: '792', properties: { name: 'Turkey' } };
  const polygons = buildHighlightPolygons([china, turkey], countryMap, collection.features);
  assert.equal(polygons.length, 19);
  assert.ok(!polygons.includes(china), 'never use the China national perimeter, even if its preset changes');
  assert.ok(polygons.includes(turkey));
  assert.equal(clickableCountryCode(turkey, countryMap), 'TR');
  for (const province of collection.features) {
    assert.ok(polygons.includes(province));
    assert.equal(highlightCountryCode(province, countryMap), 'CN');
    assert.equal(clickableCountryCode(province, countryMap), undefined);
  }
});
