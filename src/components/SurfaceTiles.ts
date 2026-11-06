import { Camera, Mesh, Object3D, Texture, Vector3 } from 'three';
import SlippyMapGlobe from './vendor/CachedSlippyMapGlobe.js';
import type { ConfigOptions } from 'three-slippy-map-globe';
import { createSurfaceMaterial } from './earthSurface';

interface SurfaceOptions {
  day: Texture;
  night: Texture;
  sun: Vector3;
  anisotropy: number;
  order: number;
  reduceMotion: boolean;
  canUpload: () => boolean;
  onResidencyChange?: () => void;
  loadImage?: (url: string) => Promise<HTMLImageElement>;
  uploadBudget?: number;
}

/** Ordered, fading tiles; low and high LODs never compete in the depth buffer. */
export class SurfaceTiles extends SlippyMapGlobe {
  private pending: Mesh[] = [];
  private uploadFrame = 0;
  private surface: SurfaceOptions;

  get loadedTileCount() {
    return this.children.filter(child => child instanceof Mesh && child.material?.uniforms?.surfaceOpacity).length;
  }

  get residentTileCount() { return this.loadedTileCount + this.pending.length; }

  resumeUploads() {
    if (this.pending.length) this.scheduleUploads();
  }

  dispose() {
    this.clearTiles();
    // clearTiles handles tile resources, but not the protective inner sphere.
    for (const child of [...this.children]) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.map?.dispose();
          material.dispose();
        }
      }
      this.remove(child);
    }
    this.removeFromParent();
  }

  constructor(radius: number, surface: SurfaceOptions, config: ConfigOptions) {
    super(radius, config);
    this.surface = surface;
    if (surface.loadImage) {
      // The local engine adapter accepts an instance loader, so both foreground
      // and background tiles use the same disk cache and in-flight requests.
      this.textureLoader = {
        load(url, onLoad, _progress, onError) {
          const texture = new Texture();
          surface.loadImage!(url).then(image => {
            texture.image = image; texture.needsUpdate = true; onLoad(texture);
          }, error => { texture.dispose(); onError?.(error); });
          return texture;
        },
      };
    }
    // The dependency exposes clearTiles as an instance-bound function.
    const clear = this.clearTiles.bind(this);
    this.clearTiles = () => {
      clear();
      cancelAnimationFrame(this.uploadFrame);
      this.uploadFrame = 0;
      this.pending = [];
    };
  }

  override add(...objects: Object3D[]) {
    for (const object of objects) {
      if (object instanceof Mesh && object.material?.map) {
        // A late image callback may arrive during a camera flight. Keep its
        // upload off that animation's critical path and handle two per frame.
        object.geometry.addEventListener('dispose', () => {
          object.userData.surfaceDisposed = true;
        });
        this.pending.push(object);
        this.surface.onResidencyChange?.();
        this.scheduleUploads();
      } else {
        // The upstream constructor adds its protective sphere before our fields
        // are initialized. It stays behind the local globe.
        super.add(object);
      }
    }
    return this;
  }

  private scheduleUploads() {
    if (this.uploadFrame || !this.visible) return;
    this.uploadFrame = requestAnimationFrame(() => {
      this.uploadFrame = 0;
      if (this.visible && this.surface.canUpload()) {
        let budget = this.surface.uploadBudget ?? 2;
        while (budget > 0 && this.pending.length) {
          const object = this.pending.shift()!;
          if (object.userData.surfaceDisposed) continue;
          const previous = object.material as any;
          const texture = previous.map as Texture;
          texture.anisotropy = this.surface.anisotropy;
          const material = createSurfaceMaterial(
            this.surface.day, this.surface.night, this.surface.sun, texture,
          );
          // Keep a map reference for the upstream resource disposer.
          (material as any).map = texture;
          material.transparent = true;
          material.depthWrite = false;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -1;
          material.polygonOffsetUnits = -1;
          object.material = material;
          const width = (object.geometry as any).parameters.phiLength;
          const level = Math.round(Math.log2(2 * Math.PI / width));
          // Transparent country outlines use order 0; tiles must precede them.
          object.renderOrder = this.surface.order + level;
          let firstFrame: number | undefined;
          object.onBeforeRender = () => {
            const now = performance.now();
            firstFrame ??= now;
            material.uniforms.surfaceOpacity.value = this.surface.reduceMotion
              ? 1 : Math.min(1, (now - firstFrame) / 240);
          };
          previous.dispose();
          super.add(object);
          budget--;
        }
      }
      if (this.pending.length && this.visible) this.scheduleUploads();
    });
  }

  override updatePov(camera: Camera) {
    super.updatePov(camera);
    // The upstream LOD setter toggles depthWrite. Our layer order and alpha
    // compositing replace that policy, including for previously loaded tiles.
    for (const child of this.children) {
      if (child instanceof Mesh && child.material?.uniforms?.surfaceOpacity) {
        child.material.depthWrite = false;
      }
    }
  }

}
