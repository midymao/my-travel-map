interface CacheView {
  visible: boolean;
  residentTileCount: number;
  resumeUploads(): void;
  dispose(): void;
}

/** Retain complete view engines, including GPU textures, materials and fade state. */
export class TileViewCache<T extends CacheView> {
  private entries = new Map<string, T>();
  private activeKey?: string;
  hits = 0;
  misses = 0;
  evictions = 0;
  private create: (key: string) => T;
  private maxViews: number;
  private maxTiles: number;

  constructor(
    create: (key: string) => T,
    maxViews: number,
    maxTiles: number,
  ) {
    this.create = create;
    this.maxViews = maxViews;
    this.maxTiles = maxTiles;
  }

  get size() { return this.entries.size; }
  get residentTiles() {
    return [...this.entries.values()].reduce((sum, view) => sum + view.residentTileCount, 0);
  }

  /** Decode a destination's cached images while its camera flight is running. */
  prepare(key: string): T {
    let view = this.entries.get(key);
    if (!view) {
      view = this.create(key);
      this.entries.set(key, view);
    }
    return view;
  }

  activate(key: string): T {
    if (key === this.activeKey) return this.entries.get(key)!;
    let view = this.entries.get(key);
    if (view) this.hits++;
    else {
      this.misses++;
      view = this.create(key);
    }
    this.hide();
    // Map insertion order is the least-recently-used order.
    this.entries.delete(key);
    this.entries.set(key, view);
    this.activeKey = key;
    view.visible = true;
    view.resumeUploads();
    this.trim();
    return view;
  }

  hide() {
    for (const view of this.entries.values()) view.visible = false;
    this.activeKey = undefined;
  }

  trim() {
    const protectedKey = this.activeKey ?? [...this.entries.keys()].at(-1);
    for (const [key, view] of this.entries) {
      if (this.size <= this.maxViews && this.residentTiles <= this.maxTiles) break;
      // Preserve the displayed view, or the most recent one while in overview.
      // Otherwise an oversized current view would be erased on hide alone.
      if (key === protectedKey) continue;
      this.entries.delete(key);
      view.dispose();
      this.evictions++;
    }
  }
}
