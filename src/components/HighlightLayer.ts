import { Color, Float32BufferAttribute, Group, InstancedBufferAttribute, Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import ConicPolygonGeometry from 'three-conic-polygon-geometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { highlightCountryCode, uniqueBoundarySegments } from './globeHighlights';
import type { HighlightFeature } from './globeHighlights';

type CountryMap = Map<number, { code: string }>;

const fillVertex = `
  attribute float highlightRegion;
  varying float fillRegion;
  void main() {
    fillRegion = highlightRegion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fillFragment = `
  uniform vec3 tint;
  uniform float selectedRegion;
  uniform float focused;
  uniform float detail;
  varying float fillRegion;
  void main() {
    float selected = 1.0 - step(0.5, abs(fillRegion - selectedRegion));
    float alpha = mix(0.175, 0.24, selected);
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
  private readonly pickers = new Map<HighlightFeature, Mesh>();
  private readonly pickMaterial = new MeshBasicMaterial({ visible: false });
  private readonly regionIds = new Map<string, number>();
  private readonly selectedRegion = { value: 0 };
  private fill?: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly focused = { value: 0 };
  private readonly detail = { value: 0 };
  constructor(features: HighlightFeature[], countries: CountryMap) {
    super();
    this.buildFills(features, countries);
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
      material.uniforms.focused = this.focused;
      material.uniforms.selectedTint = { value: new Color('#c2dce6') };
      material.vertexShader = `attribute float instanceSelected; varying float boundarySelected;\n${material.vertexShader}`
        .replace('void main() {', `void main() {
          boundarySelected = instanceSelected;`);
      material.fragmentShader = `uniform float focused; uniform vec3 selectedTint;
        varying float boundarySelected;\n${material.fragmentShader}`
        .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', `
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

  private buildFills(features: HighlightFeature[], countries: CountryMap) {
    const featureGeometries: BufferGeometry[] = [];
    for (const feature of features) {
      const shape = feature.geometry;
      if (!shape?.coordinates) continue;
      const coordinates = shape.coordinates;
      const polygons = shape.type === 'Polygon'
        ? [coordinates as number[][][]] : coordinates as number[][][][];
      const parts = polygons.map(rings => {
        const geometry = new ConicPolygonGeometry(rings, 0, 100.4, false, true, false, 5);
        geometry.deleteAttribute('normal');
        geometry.deleteAttribute('uv');
        return geometry;
      });
      if (!parts.length) continue;
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      const code = highlightCountryCode(feature, countries);
      if (code && !this.regionIds.has(code)) this.regionIds.set(code, this.regionIds.size + 1);
      const region = code ? this.regionIds.get(code)! : -1;
      geometry.setAttribute('highlightRegion',
        new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(region), 1));
      featureGeometries.push(geometry);
      // The mesh remains available to Raycaster, while its invisible material
      // keeps it out of the render list entirely.
      this.pickers.set(feature, new Mesh(geometry, this.pickMaterial));
    }
    if (!featureGeometries.length) return;
    const geometry = mergeGeometries(featureGeometries);
    if (!geometry) return;
    const material = new ShaderMaterial({
      uniforms: {
        tint: { value: new Color('#55aee0') },
        focused: this.focused, detail: this.detail, selectedRegion: this.selectedRegion,
      },
      vertexShader: fillVertex, fragmentShader: fillFragment,
      transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    });
    this.fill = new Mesh(geometry, material);
    this.fill.raycast = () => {};
    this.add(this.fill);
  }

  pickerFor(feature: HighlightFeature) {
    return this.pickers.get(feature);
  }

  setSelection(code: string | null) {
    this.focused.value = code ? 1 : 0;
    this.selectedRegion.value = code ? this.regionIds.get(code) ?? 0 : 0;
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
    this.fill?.geometry.dispose();
    this.fill?.material.dispose();
    this.pickers.forEach(mesh => { mesh.geometry.dispose(); mesh.removeFromParent(); });
    this.pickers.clear();
    this.pickMaterial.dispose();
    this.removeFromParent();
  }
}
