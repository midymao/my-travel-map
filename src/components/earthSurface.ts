import { ShaderMaterial, SRGBColorSpace, Texture, Vector3 } from 'three';

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
  uniform sampler2D nightTexture;
  uniform sampler2D baseTexture;
  uniform vec3 sunDir;
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
  void main() {
    vec3 n = normalize(vSurface);
    vec2 earthUv = vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5,
                        asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5);
    vec3 base = texture2D(baseTexture, earthUv).rgb;
    vec3 day = isTile ? texture2D(dayTexture, vUv).rgb : base;
    vec3 night = texture2D(nightTexture, earthUv).rgb;
    float sunlight = dot(n, sunDir);
    float daylight = smoothstep(-0.10, 0.14, sunlight);

    // Keep the 8K bathymetric pattern through LOD changes. Featureless offshore
    // satellite water must not erase it; turquoise shallows retain more of the
    // active imagery so reefs and coastal detail remain visible.
    float sea = smoothstep(0.005, 0.035, base.b - max(base.r, base.g));
    // Subtle procedural tonal variation, not measured bathymetry or animated waves.
    float currents = 0.60 * noise(n * 24.0) + 0.40 * noise(n * 63.0);
    vec3 deepSea = mix(vec3(0.004, 0.017, 0.042), vec3(0.009, 0.045, 0.080), currents);
    float shallows = smoothstep(0.045, 0.16, day.g)
      * smoothstep(0.45, 0.9, day.g / max(day.b, 0.001));
    vec3 waterDetail = isTile ? mix(base, day, mix(0.35, 0.85, shallows)) : base;
    vec3 ocean = waterDetail * mix(0.88, 1.12, currents);
    ocean = mix(ocean, deepSea, 0.08);
    day = mix(day, ocean, sea);

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfway = normalize(sunDir + viewDir);
    float fresnel = 0.025 + 0.975 * pow(1.0 - max(dot(n, viewDir), 0.0), 5.0);
    float glint = pow(max(dot(n, halfway), 0.0), 100.0);
    vec3 reflection = vec3(1.0, 0.88, 0.68) * glint * (0.14 + fresnel * 0.7);
    reflection += vec3(0.025, 0.07, 0.11) * fresnel;
    float diffuse = 0.50 + 0.50 * sqrt(max(sunlight, 0.0));
    vec3 lit = day * diffuse + reflection * sea * smoothstep(0.0, 0.2, sunlight);
    vec3 dark = base * 0.012 + night * 0.85;
    gl_FragColor = vec4(mix(dark, lit, daylight), surfaceOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSurfaceMaterial(
  day: Texture, night: Texture, sun: Vector3, tile?: Texture,
) {
  day.colorSpace = night.colorSpace = SRGBColorSpace;
  if (tile) tile.colorSpace = SRGBColorSpace;
  return new ShaderMaterial({
    uniforms: {
      dayTexture: { value: tile ?? day },
      baseTexture: { value: day },
      nightTexture: { value: night },
      sunDir: { value: sun },
      isTile: { value: !!tile },
      surfaceOpacity: { value: 1 },
    },
    vertexShader, fragmentShader,
  });
}
