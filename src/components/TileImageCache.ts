import { tileKey, type TileAddress } from './countryTilePlan';

export interface PreloadProgress { done: number; total: number; failed: number; bytes: number }
export interface PreloadSchedule {
  paused?: () => boolean;
  priority?: () => TileAddress[];
  score?: (tile: TileAddress) => number;
}
export async function waitForPreloadIdle(signal: AbortSignal, paused?: () => boolean) {
  while (!signal.aborted && paused?.()) {
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, 150);
      signal.addEventListener('abort', finish, { once: true });
    });
  }
  return !signal.aborted;
}
interface TileTask {
  tile: TileAddress; source: string; foreground: boolean; started: boolean;
  promise: Promise<Blob>; resolve: (blob: Blob) => void; reject: (error: unknown) => void;
}
const CACHE_NAME = 'midy-country-imagery-v1';
const cacheRequest = (tile: TileAddress) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileKey(tile)}`;

/** One request pipeline for visible tiles and speculative prefetches. Blobs
 * have a bounded RAM LRU and persistent disk cache. Only displayed tiles are
 * decoded, and concurrent consumers share the same decode. */
export class TileImageCache {
  private blobs = new Map<string, Blob>();
  private tasks = new Map<string, TileTask>();
  private decodes = new Map<string, Promise<unknown>>();
  private storage?: Cache;
  private opening?: Promise<void>;
  private bytes = 0;
  private maxBytes: number;
  private active = 0;
  private activeBackground = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private lifetime = new AbortController();
  private scheduling: PreloadSchedule = {};
  private maxRequests = 6;
  constructor(maxBytes = 96 * 1024 * 1024) { this.maxBytes = maxBytes; }
  get size() { return this.blobs.size; }
  has(tile: TileAddress) { return this.blobs.has(tileKey(tile)); }
  configure(schedule: PreloadSchedule, maxRequests = 6) {
    this.scheduling = schedule; this.maxRequests = maxRequests; this.pump();
  }
  open() {
    this.opening ??= (async () => {
      try { this.storage = await caches.open(CACHE_NAME); }
      catch { /* Private browsing still supports the RAM cache. */ }
    })();
    return this.opening;
  }
  load(tile: TileAddress, source: string, foreground = true): Promise<Blob> {
    if (this.disposed) return Promise.reject(new Error('Tile cache disposed'));
    const key = tileKey(tile), cached = this.blobs.get(key);
    if (cached) {
      this.blobs.delete(key); this.blobs.set(key, cached);
      return Promise.resolve(cached);
    }
    const existing = this.tasks.get(key);
    if (existing) {
      if (foreground) existing.foreground = true;
      this.pump(); return existing.promise;
    }
    let resolve!: TileTask['resolve'], reject!: TileTask['reject'];
    const promise = new Promise<Blob>((yes, no) => { resolve = yes; reject = no; });
    this.tasks.set(key, { tile, source, foreground, started: false, promise, resolve, reject });
    // Collect same-turn renderer requests before selecting sunlit tiles.
    this.timer ??= setTimeout(() => { this.timer = undefined; this.pump(); }, 0);
    return promise;
  }
  decode<T>(tile: TileAddress, source: string, decoder: (blob: Blob) => Promise<T>): Promise<T> {
    const key = tileKey(tile), existing = this.decodes.get(key);
    if (existing) return existing as Promise<T>;
    const promise = this.load(tile, source, true).then(decoder).finally(() => this.decodes.delete(key));
    this.decodes.set(key, promise); return promise;
  }
  private pump() {
    if (this.disposed) return;
    clearTimeout(this.timer); this.timer = undefined;
    while (this.active < this.maxRequests) {
      const candidates = [...this.tasks.values()].filter(task => !task.started &&
        (task.foreground || (!this.scheduling.paused?.() && this.activeBackground < (this.maxRequests >= 6 ? 2 : 1))));
      candidates.sort((a, b) => Number(b.foreground) - Number(a.foreground) ||
        (this.scheduling.score?.(b.tile) ?? 0) - (this.scheduling.score?.(a.tile) ?? 0));
      const task = candidates[0]; if (!task) break;
      task.started = true;
      const background = !task.foreground;
      this.active++; if (background) this.activeBackground++;
      void this.fetchTile(task).then(task.resolve, task.reject).finally(() => {
        this.tasks.delete(tileKey(task.tile));
        this.active--; if (background) this.activeBackground--;
        this.pump();
      });
    }
    if ([...this.tasks.values()].some(task => !task.started))
      this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, 150);
  }
  private async fetchTile(task: TileTask) {
    await this.open();
    const key = cacheRequest(task.tile);
    let response: Response | undefined;
    try { response = await this.storage?.match(key); } catch { /* Use network. */ }
    const fromDisk = !!response;
    if (!response) {
      const request = (url: string) => fetch(url, { mode: 'cors', signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(6000)]) });
      try {
        response = await request(task.source);
        if (!response.ok) throw new Error(`Tile HTTP ${response.status}`);
      } catch (error) {
        if (this.disposed || !task.source.includes('server.arcgisonline.com')) throw error;
        response = await request(task.source.replace('server.arcgisonline.com', 'services.arcgisonline.com'));
      }
    }
    if (!response.ok) throw new Error(`Tile HTTP ${response.status}`);
    const blob = await response.blob();
    // Verify signatures without decoding thousands of off-screen images.
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (!(header[0] === 0xff && header[1] === 0xd8) &&
      !(header[0] === 0x89 && header[1] === 0x50) &&
      !(header[0] === 0x52 && header[1] === 0x49 && header[8] === 0x57 && header[9] === 0x45))
      throw new Error('Invalid tile image');
    if (this.disposed) throw new Error('Tile cache disposed');
    while (this.bytes + blob.size > this.maxBytes && this.blobs.size) {
      const oldest = this.blobs.keys().next().value!;
      this.bytes -= this.blobs.get(oldest)!.size; this.blobs.delete(oldest);
    }
    this.blobs.set(tileKey(task.tile), blob); this.bytes += blob.size;
    if (!fromDisk && this.storage) {
      // Disk writes never hold up a visible tile.
      void this.storage.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(() => {});
    }
    return blob;
  }
  async preload(tiles: TileAddress[], source: (tile: TileAddress) => string,
    onProgress: (progress: PreloadProgress) => void, signal: AbortSignal, concurrency = 2, schedule: PreloadSchedule = {}) {
    const queue = new Map(tiles.map(tile => [tileKey(tile), tile]));
    const progress: PreloadProgress = { done: 0, total: queue.size, failed: 0, bytes: this.bytes };
    let failures = 0;
    let ranked: TileAddress[] = [], lastSort = -Infinity;
    onProgress({ ...progress });
    const worker = async () => {
      while (queue.size && !signal.aborted && failures < 12 && !this.disposed) {
        if (!await waitForPreloadIdle(signal, schedule.paused) || !queue.size) break;
        const preferred = schedule.priority?.().find(tile => queue.has(tileKey(tile)));
        if (schedule.score && (!ranked.length || performance.now() - lastSort > 2000)) {
          ranked = [...queue.values()].sort((a, b) => schedule.score!(b) - schedule.score!(a));
          lastSort = performance.now();
        }
        while (ranked.length && !queue.has(tileKey(ranked[0]))) ranked.shift();
        const tile = preferred ?? ranked.shift() ?? queue.values().next().value!;
        queue.delete(tileKey(tile));
        try { await this.load(tile, source(tile), false); failures = 0; }
        catch { progress.failed++; failures++; }
        progress.done++; progress.bytes = this.bytes;
        onProgress({ ...progress });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { ...progress, complete: progress.done === progress.total && progress.failed === 0 };
  }
  dispose() {
    this.disposed = true; this.lifetime.abort(); clearTimeout(this.timer);
    for (const task of this.tasks.values()) if (!task.started) task.reject(new Error('Tile cache disposed'));
    this.tasks.clear(); this.blobs.clear(); this.decodes.clear(); this.bytes = 0;
  }
}
