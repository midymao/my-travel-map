import { Camera, Frustum, Matrix4, Vector3 } from 'three';
import { tileKey, type TileAddress } from './countryTilePlan';

const latAt = (y: number, size: number) => y === 0 ? 90 : y === size ? -90
  : Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI;
function normal(lat: number, lng: number) {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180;
  return new Vector3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
}

/** Selected destination > visible tiles > elsewhere. */
export class TilePriority {
  private eye = new Vector3(0, 0, 340);
  private frustum = new Frustum();
  private selected = new Set<string>();
  private samples = new Map<string, Vector3[]>();
  private scores = new Map<string, number>();
  private lastUpdate = -Infinity;

  update(camera: Camera, selected?: TileAddress[], force = false) {
    if (!force && performance.now() - this.lastUpdate < 150) return;
    this.lastUpdate = performance.now();
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
    // Frustum alone also contains the back of a globe; reject occluded samples.
    const visible = samples.some(n => n.dot(this.eye) >= 99.5 &&
      this.frustum.planes.every(plane => plane.normal.dot(n) * 100.06 + plane.constant >= 0));
    const region = this.selected.has(key) ? 6000 : visible ? 4000 : 0;
    const score = region + tile.level;
    this.scores.set(key, score);
    return score;
  }
}
