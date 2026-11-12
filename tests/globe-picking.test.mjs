import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Mesh, MeshBasicMaterial, Raycaster, Scene, SphereGeometry, Vector3 } from 'three';

const source = (await readFile(new URL('../src/components/globePicking.ts', import.meta.url), 'utf8'))
  .replaceAll('from "three"', `from '${import.meta.resolve('three')}'`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { useGlobeSpherePicking } = await import(moduleUrl);

test('sphere picking keeps near-side country hits ahead of the globe and occludes far-side hits', () => {
  const scene = new Scene();
  const globe = new Mesh(new SphereGeometry(100));
  const atmosphere = new Mesh(new SphereGeometry(118));
  atmosphere.__globeObjType = 'atmosphere';
  const nearCountry = new Mesh(new SphereGeometry(2), new MeshBasicMaterial({ visible: false }));
  nearCountry.position.z = 100;
  const farCountry = nearCountry.clone();
  farCountry.position.z = -100;
  scene.add(globe, atmosphere, nearCountry, farCountry);
  scene.updateMatrixWorld(true);
  useGlobeSpherePicking(scene, globe.material, 100);

  const ray = new Raycaster(new Vector3(0, 0, 250), new Vector3(0, 0, -1));
  const hits = ray.intersectObject(scene, true);
  assert.equal(hits[0].object, nearCountry);
  const globeHit = hits.find(hit => hit.object === globe);
  assert.deepEqual(globeHit.point.toArray(), [0, 0, 100]);
  assert.ok(hits.find(hit => hit.object === farCountry).distance > globeHit.distance);
  assert.ok(!hits.some(hit => hit.object === atmosphere));
  ray.far = 149;
  assert.equal(ray.intersectObject(globe).length, 0);
  ray.set(new Vector3(110, 0, 250), new Vector3(0, 0, -1));
  ray.far = Infinity;
  assert.equal(ray.intersectObject(globe).length, 0);
});
