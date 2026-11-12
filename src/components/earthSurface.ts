import { ShaderMaterial, SRGBColorSpace, Texture } from 'three';

// Base globe and satellite tiles use identical world-space lighting.
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vSurface;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vSurface = normalize(world.xyz);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D baseTexture;
  uniform bool isTile;
  uniform float surfaceOpacity;
  varying vec2 vUv;
  varying vec3 vSurface;
  varying vec3 vWorldPosition;
  const float PI = 3.141592653589793;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.3, 0.7));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  vec3 litSurface(vec3 n, vec3 base) {
    vec3 day = isTile ? texture2D(dayTexture, vUv).rgb : base;
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(dot(n, viewDir), 0.0, 1.0);
    // Even daylight, with a gentle falloff at the edge to retain the sphere's depth.
    float diffuse = 0.90 + 0.10 * facing;

    // Keep the 8K bathymetric pattern through LOD changes. Featureless offshore
    // satellite water must not erase it; turquoise shallows retain more of the
    // active imagery so reefs and coastal detail remain visible.
    float sea = smoothstep(0.005, 0.035, base.b - max(base.r, base.g));
    // Land uses the same lighting without paying for the ocean shader.
    if (sea == 0.0) return day * diffuse;

    // Subtle procedural tonal variation, not measured bathymetry or animated waves.
    float currents = 0.60 * noise(n * 24.0) + 0.40 * noise(n * 63.0);
    vec3 deepSea = mix(vec3(0.004, 0.017, 0.042), vec3(0.009, 0.045, 0.080), currents);
    float shallows = smoothstep(0.045, 0.16, day.g)
      * smoothstep(0.45, 0.9, day.g / max(day.b, 0.001));
    vec3 waterDetail = isTile ? mix(base, day, mix(0.35, 0.85, shallows)) : base;
    vec3 ocean = waterDetail * mix(0.88, 1.12, currents);
    ocean = mix(ocean, deepSea, 0.08);
    day = mix(day, ocean, sea);

    float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);
    vec3 reflection = vec3(0.010, 0.027, 0.042) * fresnel;
    return day * diffuse + reflection * sea;
  }

  void main() {
    vec3 n = normalize(vSurface);
    vec2 earthUv = vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5,
                        asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5);
    vec3 base = texture2D(baseTexture, earthUv).rgb;
    gl_FragColor = vec4(litSurface(n, base), surfaceOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSurfaceMaterial(day: Texture, tile?: Texture) {
  day.colorSpace = SRGBColorSpace;
  if (tile) tile.colorSpace = SRGBColorSpace;
  return new ShaderMaterial({
    uniforms: {
      dayTexture: { value: tile ?? day },
      baseTexture: { value: day },
      isTile: { value: !!tile },
      surfaceOpacity: { value: 1 },
    },
    vertexShader, fragmentShader,
  });
}
