import { readFile, writeFile } from 'node:fs/promises';
import { feature } from 'topojson-client';
import { geoArea } from 'd3-geo';

// Download source: https://geojson.cn/api/tiandi/0.3.0/100000.topo.json
// Run: node scripts/prepare-china-provinces.mjs <source.topo.json>
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the downloaded source TopoJSON file.');
const codes = ['330000', '310000', '320000', '370000', '120000', '110000',
  '130000', '210000', '140000', '610000', '620000', '630000', '540000',
  '510000', '410000', '420000', '440000', '810000'];
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const geometries = source.objects.default.geometries.filter(g => codes.includes(g.properties.code));
if (geometries.length !== codes.length) throw new Error('Missing or duplicate requested provinces.');

// Simplify shared arcs once so adjacent provinces keep identical boundaries.
// Hong Kong retains finer geometry, including its shared Guangdong boundary.
const tolerances = new Map();
function visitArcs(value, tolerance) {
  for (const item of value) {
    if (Array.isArray(item)) visitArcs(item, tolerance);
    else {
      const index = item < 0 ? ~item : item;
      tolerances.set(index, Math.min(tolerances.get(index) ?? Infinity, tolerance));
    }
  }
}
for (const g of geometries) visitArcs(g.arcs, g.properties.code === '810000' ? 0.001 : 0.008);

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first], b = points[last];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    let furthest = -1, distance = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
      const d = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      if (d > distance) { distance = d; furthest = i; }
    }
    if (furthest >= 0) {
      keep.add(furthest);
      stack.push([first, furthest], [furthest, last]);
    }
  }
  const result = points.filter((_, i) => keep.has(i));
  const closed = points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  return closed && result.length < 4 ? points : result;
}

const indices = [...tolerances.keys()];
const remap = new Map(indices.map((index, i) => [index, i]));
const arcs = indices.map(index => {
  let x = 0, y = 0;
  const points = source.arcs[index].map(p => {
    if (!source.transform) return p;
    x += p[0]; y += p[1];
    return [x * source.transform.scale[0] + source.transform.translate[0],
      y * source.transform.scale[1] + source.transform.translate[1]];
  });
  return simplify(points, tolerances.get(index)).map(p => p.map(v => Number(v.toFixed(6))));
});
function remapArcs(value) {
  return value.map(v => Array.isArray(v) ? remapArcs(v) : v < 0 ? ~remap.get(~v) : remap.get(v));
}
const topology = { type: 'Topology', arcs, objects: { provinces: {
  type: 'GeometryCollection',
  geometries: geometries.map(g => ({ ...g, arcs: remapArcs(g.arcs) })),
} } };
const collection = feature(topology, topology.objects.provinces);
for (const f of collection.features) {
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const ring = polygon[i];
      if (ring.length < 4) throw new Error(`Invalid ring: ${f.properties.name}`);
      const smallSide = geoArea({ type: 'Polygon', coordinates: [ring] }) < 2 * Math.PI;
      if (i === 0 ? !smallSide : smallSide) ring.reverse();
    }
  }
  f.id = `CN-${f.properties.code}`;
  f.properties = { code: f.properties.code, name: f.properties.name,
    countryCode: 'CN', highlightType: 'province' };
}
collection.features.sort((a, b) => codes.indexOf(a.properties.code) - codes.indexOf(b.properties.code));
collection.source = {
  title: 'GeoJSON.CN · 天地图省级边界',
  url: 'https://geojson.cn/data/atlas/tiandi',
  dataUrl: 'https://geojson.cn/api/tiandi/0.3.0/100000.topo.json',
  coordinateReference: 'CGCS2000 (EPSG:4490)',
  copyright: source.meta,
  processing: 'Requested provinces only; shared-arc simplification; spherical ring winding normalized.',
};
const output = JSON.stringify(collection) + '\n';
await writeFile(new URL('../public/data/china-provinces.geo.json', import.meta.url), output);
console.log(JSON.stringify({ provinces: collection.features.map(f => f.properties.name), bytes: Buffer.byteLength(output) }));
