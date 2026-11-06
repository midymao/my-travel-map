import { Color, Group, InstancedBufferAttribute, ShaderMaterial, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { highlightCountryCode, uniqueBoundarySegments } from './globeHighlights';
import type { HighlightFeature } from './globeHighlights';

type CountryMap = Map<number, { code: string }>;

const fillVertex = `
  varying vec3 highlightSurface;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    highlightSurface = normalize(world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fillFragment = `
  uniform vec3 sunDir;
  uniform vec3 tint;
  uniform float selected;
  uniform float focused;
  uniform float detail;
  varying vec3 highlightSurface;
  void main() {
    float daylight = smoothstep(-0.10, 0.14, dot(normalize(highlightSurface), sunDir));
    float alpha = mix(0.105, 0.175, daylight);
    alpha = mix(alpha, mix(0.15, 0.24, daylight), selected);
    alpha *= mix(1.0, 0.76, detail);
    alpha *= mix(1.0, 0.62, focused * (1.0 - selected));
    gl_FragColor = vec4(tint, alpha);
    #include <colorspace_fragment>
  }
`;

function surfacePoint(p: number[]) {
  const lat = p[1] * Math.PI / 180, lng = p[0] * Math.PI / 180;
  return new Vector3(Math.cos(lat) * Math.sin(lng), Math.sin(lat), Math.cos(lat) * Math.cos(lng));
}

export class HighlightLayer extends Group {
  readonly geometry = new LineSegmentsGeometry();
  readonly materials: LineMaterial[] = [];
  readonly uniqueSegmentCount: number;
  private readonly owners: Set<string>[] = [];
  private readonly selectedAttribute: InstancedBufferAttribute;
  private readonly fills = new Map<HighlightFeature, ShaderMaterial>();
  private readonly focused = { value: 0 };
  private readonly detail = { value: 0 };
  private selectedCode: string | null = null;
  private countries: CountryMap;
  private sun: Vector3;

  constructor(features: HighlightFeature[], countries: CountryMap, sun: Vector3) {
    super();
    this.countries = countries;
    this.sun = sun;
    const segments = uniqueBoundarySegments(features, countries);
    this.uniqueSegmentCount = segments.length;
    const positions: number[] = [];
    // Subdivide long arcs so screen-space strokes follow the sphere rather than
    // taking a chord through it. Geometry is built once, never during camera moves.
    for (const segment of segments) {
      const a = surfacePoint(segment.start), b = surfacePoint(segment.end);
      const angle = a.angleTo(b);
      const steps = Math.max(1, Math.ceil(angle / (0.5 * Math.PI / 180)));
      let previous = a.clone().multiplyScalar(100.46);
      for (let i = 1; i <= steps; i++) {
        const next = a.clone().lerp(b, i / steps).normalize().multiplyScalar(100.46);
        positions.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
        this.owners.push(segment.owners);
        previous = next;
      }
    }
    this.geometry.setPositions(positions);
    this.selectedAttribute = new InstancedBufferAttribute(new Float32Array(this.owners.length), 1);
    this.geometry.setAttribute('instanceSelected', this.selectedAttribute);

    // Three inexpensive passes share one geometry: a fine core and two soft
    // skirts. No full-screen bloom, additive glare, pulsing, or extra frame loop.
    const passes = [
      { width: 6, opacity: 0.025, color: '#669bb8', glow: true },
      { width: 3, opacity: 0.075, color: '#81b1c8', glow: true },
      { width: 1.15, opacity: 0.82, color: '#9bc8da', glow: false },
    ];
    passes.forEach((pass, index) => {
      const material = new LineMaterial({
        color: pass.color, linewidth: pass.width, opacity: pass.opacity,
        transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
      });
      material.uniforms.sunDir = { value: sun };
      material.uniforms.focused = this.focused;
      material.uniforms.selectedTint = { value: new Color('#c2dce6') };
      material.vertexShader = `attribute float instanceSelected; varying float boundarySelected; varying vec3 boundarySurface;\n${material.vertexShader}`
        .replace('void main() {', `void main() {
          boundarySelected = instanceSelected;
          vec3 boundaryPoint = position.y < 0.5 ? instanceStart : instanceEnd;
          boundarySurface = normalize((modelMatrix * vec4(boundaryPoint, 1.0)).xyz);`);
      material.fragmentShader = `uniform vec3 sunDir; uniform float focused; uniform vec3 selectedTint;
        varying float boundarySelected; varying vec3 boundarySurface;\n${material.fragmentShader}`
        .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', `
          float daylight = smoothstep(-0.10, 0.14, dot(normalize(boundarySurface), sunDir));
          alpha *= mix(0.68, 1.0, daylight);
          alpha *= mix(1.0, 0.72, focused * (1.0 - boundarySelected));
          ${pass.glow ? 'alpha *= exp(-3.5 * vUv.x * vUv.x);' : 'alpha *= 1.0 - smoothstep(0.55, 1.0, abs(vUv.x));'}
          vec3 ink = mix(diffuseColor.rgb, selectedTint, boundarySelected * ${pass.glow ? '0.15' : '0.65'});
          gl_FragColor = vec4(ink, alpha);`);
      const line = new LineSegments2(this.geometry, material);
      line.renderOrder = 20 + index;
      line.frustumCulled = false;
      line.raycast = () => {}; // Never intercept country or province picking.
      this.materials.push(material);
      this.add(line);
    });
  }

  fillMaterial(feature: HighlightFeature) {
    let material = this.fills.get(feature);
    if (!material) {
      material = new ShaderMaterial({
        uniforms: {
          sunDir: { value: this.sun }, tint: { value: new Color('#55aee0') },
          focused: this.focused, detail: this.detail,
          selected: { value: highlightCountryCode(feature, this.countries) === this.selectedCode ? 1 : 0 },
        },
        vertexShader: fillVertex, fragmentShader: fillFragment,
        transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
      });
      this.fills.set(feature, material);
    }
    return material;
  }

  setSelection(code: string | null) {
    this.selectedCode = code;
    this.focused.value = code ? 1 : 0;
    for (const [feature, material] of this.fills) {
      material.uniforms.selected.value = highlightCountryCode(feature, this.countries) === code ? 1 : 0;
    }
    for (let i = 0; i < this.owners.length; i++) {
      this.selectedAttribute.setX(i, code && this.owners[i].has(code) ? 1 : 0);
    }
    this.selectedAttribute.needsUpdate = true;
  }

  setZoom(altitude: number) {
    const t = Math.max(0, Math.min(1, (2.4 - altitude) / 1.8));
    this.detail.value = t * t * (3 - 2 * t);
    this.materials[0].linewidth = 6 + 1.0 * this.detail.value;
    this.materials[1].linewidth = 3 + 0.6 * this.detail.value;
    this.materials[2].linewidth = 1.15 + 0.25 * this.detail.value;
  }

  dispose() {
    this.geometry.dispose();
    this.materials.forEach(material => material.dispose());
    this.fills.forEach(material => material.dispose());
    this.fills.clear();
    this.removeFromParent();
  }
}
