import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';

export interface TileAddress { x: number; y: number; level: number }
export interface CountryView { lat: number; lng: number; altitude: number }
export const tileKey = ({ x, y, level }: TileAddress) => `${level}/${y}/${x}`;

function point(lat: number, lng: number, radius: number) {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180;
  return new Vector3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)).multiplyScalar(radius);
}
const latitude = (y: number, size: number) => y === 0 ? 90 : y === size ? -90
  : Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI;

/** Same level thresholds, Mercator hull and search limits as the tile renderer.
 * A small field-of-view margin covers rounding and the end of camera easing. */
export function countryTilePlan(view: CountryView, template: PerspectiveCamera, coarse: boolean): TileAddress[] {
  if (view.altitude >= 1.35) return [];
  const radius = 100.06;
  const camera = template.clone();
  camera.position.copy(point(view.lat, view.lng, 100 * (1 + view.altitude)));
  camera.lookAt(0, 0, 0);
  camera.fov = Math.min(120, camera.fov + 3);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  const altitude = camera.position.length() / radius - 1;
  const level = Math.min(17, Math.max(0, Math.ceil(Math.log2((coarse ? 16 : 32) / altitude))));
  const size = 2 ** level, width = 360 / size;
  const result: TileAddress[] = [];
  const latRange = altitude * 90;
  const lngRange = latRange / Math.cos(view.lat * Math.PI / 180);
  for (let y = 0; y < size; y++) {
    const north = latitude(y, size), south = latitude(y + 1, size), lat = (north + south) / 2;
    if (level > 7 && (south > view.lat + latRange || north < view.lat - latRange)) continue;
    for (let x = 0; x < size; x++) {
      const west = -180 + x * width, east = west + width, lng = (west + east) / 2;
      if (level > 7 && (east < view.lng - lngRange || west > view.lng + lngRange)) continue;
      const center = point(lat, lng, radius);
      if (level <= 7 && center.distanceTo(camera.position) > (camera.position.length() - radius) * 3) continue;
      if ([[lat, lng], [north, west], [north, east], [south, west], [south, east]]
        .some(([a, b]) => frustum.containsPoint(point(a, b, radius)))) result.push({ x, y, level });
    }
  }
  return result;
}

export function overviewTilePlan(level: number): TileAddress[] {
  return Array.from({ length: 4 ** level }, (_, i) => ({ x: i % 2 ** level, y: Math.floor(i / 2 ** level), level }));
}
