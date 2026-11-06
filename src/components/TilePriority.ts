import { Camera, Frustum, Matrix4, Vector3 } from 'three';
import { tileKey, type TileAddress } from './countryTilePlan';

const latAt = (y: number, size: number) => y === 0 ? 90 : y === size ? -90
  : Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI;
function normal(lat: number, lng: number) {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180;
  return new Vector3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
}

/** Selected destination > visible hemisphere > elsewhere; within each group,
 * daylight > twilight > night. Scores never remove already cached imagery. */
export class TilePriority {
  private sun = new Vector3(1, 0, 0);
  private eye = new Vector3(0, 0, 340);
  private frustum = new Frustum();
  private selected = new Set<string>();
  private samples = new Map<string, Vector3[]>();
  private scores = new Map<string, number>();
  private lastUpdate = -Infinity;

  update(camera: Camera, sun: Vector3, selected?: TileAddress[], force = false) {
    if (!force && performance.now() - this.lastUpdate < 150) return;
    this.lastUpdate = performance.now();
    this.sun.copy(sun).normalize();
    this.eye.copy(camera.position);
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    if (selected) this.selected = new Set(selected.map(tileKey));
    this.scores.clear();
  }

  rank(tile: TileAddress) {
    const key = tileKey(tile);
    const cached = this.scores.get(key);
    if (cached !== undefined) return cached;
    let samples = this.samples.get(key);
    if (!samples) {
      const size = 2 ** tile.level, west = tile.x / size * 360 - 180, east = (tile.x + 1) / size * 360 - 180;
      const north = latAt(tile.y, size), south = latAt(tile.y + 1, size);
      samples = [[(north + south) / 2, (west + east) / 2], [north, west], [north, east], [south, west], [south, east]]
        .map(([lat, lng]) => normal(lat, lng));
      this.samples.set(key, samples);
    }
    const sunlight = Math.max(...samples.map(n => n.dot(this.sun)));
    // Frustum alone also contains the back of a globe; reject occluded samples.
    const visible = samples.some(n => n.dot(this.eye) >= 99.5 &&
      this.frustum.planes.every(plane => plane.normal.dot(n) * 100.06 + plane.constant >= 0));
    const region = this.selected.has(key) ? 6000 : visible ? 4000 : 0;
    const light = sunlight > 0.14 ? 300 + sunlight * 30 : sunlight >= -0.14 ? 200 : 0;
    const score = region + light + tile.level;
    this.scores.set(key, score);
    return score;
  }
}
