import { Matrix4, Mesh, Ray, Sphere, Vector3 } from "three";
import type { Material, Object3D } from "three";

/** Keep the rendered sphere detailed without testing its triangles on hover. */
export function useGlobeSpherePicking(scene: Object3D, surface: Material, radius: number) {
  const sphere = new Sphere(new Vector3(), radius);
  const inverse = new Matrix4();
  const localRay = new Ray();
  const hit = new Vector3();

  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if ((object as Mesh & { __globeObjType?: string }).__globeObjType === "atmosphere") {
      // Globe.gl filters the atmosphere out after raycasting the scene.
      object.raycast = () => {};
      return;
    }
    if (object.material !== surface) return;
    object.raycast = (raycaster, hits) => {
      inverse.copy(object.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(inverse);
      // The opaque globe uses front faces, so it cannot be picked from inside.
      if (sphere.containsPoint(localRay.origin) || !localRay.intersectSphere(sphere, hit)) return;
      hit.applyMatrix4(object.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(hit);
      if (distance < raycaster.near || distance > raycaster.far) return;
      hits.push({ distance, point: hit.clone(), object });
    };
  });
}
