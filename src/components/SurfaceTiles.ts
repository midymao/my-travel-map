import { Camera, Mesh, Object3D, Texture, Vector3 } from 'three';
import SlippyMapGlobe from './vendor/CachedSlippyMapGlobe.js';
import type { ConfigOptions } from 'three-slippy-map-globe';
import { createSurfaceMaterial } from './earthSurface';

interface SurfaceOptions {
  day: Texture;
  anisotropy: number;
  order: number;
  reduceMotion: boolean;
  canUpload: () => boolean;
  onResidencyChange?: () => void;
  loadImage?: (url: string) => Promise<HTMLImageElement>;
  uploadTexture?: (texture: Texture) => void;
  uploadBudget?: number;
}

/** Ordered, fading tiles; low and high LODs never compete in the depth buffer. */
export class SurfaceTiles extends SlippyMapGlobe {
  private pending: Mesh[] = [];
  private uploadFrame = 0;
  private surface: SurfaceOptions;
  private tileRadius: number;
  private eyeDirection = new Vector3();

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
    this.tileRadius = radius;
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
    if (this.uploadFrame || !this.pending.length || !this.visible || !this.surface.canUpload()) return;
    this.uploadFrame = requestAnimationFrame(() => {
      this.uploadFrame = 0;
      if (this.visible && this.surface.canUpload()) {
        let budget = this.surface.uploadBudget ?? 2;
        const deadline = performance.now() + 3;
        while (budget > 0 && this.pending.length) {
          const object = this.pending.shift()!;
          if (object.userData.surfaceDisposed) continue;
          if (object.userData.buildTileGeometry) {
            // The placeholder has never been rendered and owns no GPU data.
            object.geometry = object.userData.buildTileGeometry();
            delete object.userData.buildTileGeometry;
          }
          const previous = object.material as any;
          const texture = previous.map as Texture;
          texture.anisotropy = this.surface.anisotropy;
          const material = createSurfaceMaterial(this.surface.day, texture);
          // Keep a map reference for the upstream resource disposer.
          (material as any).map = texture;
          // Culled tiles should already be GPU-resident when rotation reveals them.
          this.surface.uploadTexture?.(texture);
          material.transparent = true;
          material.depthWrite = false;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -1;
          material.polygonOffsetUnits = -1;
          object.material = material;
          object.geometry.computeBoundingSphere();
          object.userData.surfaceTile = true;
          const width = (object.geometry as any).parameters.phiLength;
          const level = Math.round(Math.log2(2 * Math.PI / width));
          // Transparent country outlines use order 0; tiles must precede them.
          object.renderOrder = this.surface.order + level;
          const uploadedAt = performance.now();
          object.onBeforeRender = () => {
            material.uniforms.surfaceOpacity.value = this.surface.reduceMotion
              ? 1 : Math.min(1, (performance.now() - uploadedAt) / 240);
          };
          previous.dispose();
          super.add(object);
          budget--;
          if (performance.now() >= deadline) break;
        }
      }
      if (this.pending.length) this.scheduleUploads();
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

  updateHorizonVisibility(eye: Vector3, occluderRadius: number) {
    if (!this.visible) return;
    const distance = eye.length();
    const cull = distance > occluderRadius && this.tileRadius >= occluderRadius;
    const tangent = cull ? occluderRadius / distance : 0;
    this.eyeDirection.copy(eye).multiplyScalar(cull ? 1 / distance : 0);
    // Expand the horizon to account for tiles sitting above the opaque globe.
    const horizon = occluderRadius * tangent -
      Math.sqrt(Math.max(0, (1 - tangent ** 2) * (this.tileRadius ** 2 - occluderRadius ** 2)));
    for (const child of this.children) {
      if (!(child instanceof Mesh) || !child.userData.surfaceTile) continue;
      const bounds = child.geometry.boundingSphere;
      // Only skip meshes whose entire bounding sphere lies behind the horizon.
      child.visible = !cull || !bounds || bounds.center.dot(this.eyeDirection) + bounds.radius >= horizon;
    }
  }

}
