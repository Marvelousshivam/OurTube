import React, { useEffect, useRef, useState } from 'react';
import {
  useVideoShaderStore,
  VideoShaderPresetId,
  VideoShaderSettings,
  getPresetMeta,
  isShaderEffectActive
} from '../../store/videoShaderStore';

// ============================================================================
// Koda GLSL Shaders (Ported 1:1 from temp_koda/.../service/VideoShaderEffect.kt)
// ============================================================================

const VERTEX_SHADER = `
attribute vec2 aFramePosition;
varying vec2 vTexCoord;
void main() {
  gl_Position = vec4(aFramePosition, 0.0, 1.0);
  vTexCoord = vec2(aFramePosition.x * 0.5 + 0.5, 0.5 - aFramePosition.y * 0.5);
}
`;

const FRAGMENT_PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

const FRAGMENT_HEADER =
  FRAGMENT_PRECISION +
  `
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uSharpness;
uniform float uContrast;
uniform float uBrightness;
uniform float uSaturation;
varying vec2 vTexCoord;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float lumaOf(vec3 c) {
  return dot(c, LUMA);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 frameAt(vec2 uv) {
  vec3 c = texture2D(uTex, uv).rgb;
  if (uSharpness <= 0.0) return c;
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  vec3 a = texture2D(uTex, uv - vec2(0.0, px.y)).rgb;
  vec3 b = texture2D(uTex, uv - vec2(px.x, 0.0)).rgb;
  vec3 d = texture2D(uTex, uv + vec2(px.x, 0.0)).rgb;
  vec3 e = texture2D(uTex, uv + vec2(0.0, px.y)).rgb;
  vec3 lo = min(c, min(min(a, b), min(d, e)));
  vec3 hi = max(c, max(max(a, b), max(d, e)));
  vec3 amp = clamp(min(lo, 2.0 - hi) / max(hi, 0.001), 0.0, 1.0);
  vec3 w = -sqrt(amp) * (0.2 * uSharpness);
  return clamp((c + (a + b + d + e) * w) / (1.0 + 4.0 * w), 0.0, 1.0);
}

float edgeAt(vec2 uv, float reach) {
  vec2 d = reach / max(uResolution, vec2(1.0));
  vec3 grey = vec3(0.299, 0.587, 0.114);
  float tl = dot(texture2D(uTex, uv + vec2(-d.x, -d.y)).rgb, grey);
  float tr = dot(texture2D(uTex, uv + vec2( d.x, -d.y)).rgb, grey);
  float bl = dot(texture2D(uTex, uv + vec2(-d.x,  d.y)).rgb, grey);
  float br = dot(texture2D(uTex, uv + vec2( d.x,  d.y)).rgb, grey);
  float t  = dot(texture2D(uTex, uv + vec2( 0.0, -d.y)).rgb, grey);
  float b  = dot(texture2D(uTex, uv + vec2( 0.0,  d.y)).rgb, grey);
  float l  = dot(texture2D(uTex, uv + vec2(-d.x,  0.0)).rgb, grey);
  float r  = dot(texture2D(uTex, uv + vec2( d.x,  0.0)).rgb, grey);
  float h = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float v = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  return sqrt(h * h + v * v);
}

float scanlinesAt(float y) {
  return min(max(uResolution.y, 1.0) * 0.5, 240.0) * y * 6.2832;
}

vec3 softAt(vec2 uv, float spread) {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 r = spread * vec2(res.y / res.x, 1.0);
  vec3 sum = texture2D(uTex, uv).rgb * 2.0;
  sum += texture2D(uTex, uv + r * vec2( 1.0,  0.0)).rgb;
  sum += texture2D(uTex, uv + r * vec2(-1.0,  0.0)).rgb;
  sum += texture2D(uTex, uv + r * vec2( 0.0,  1.0)).rgb;
  sum += texture2D(uTex, uv + r * vec2( 0.0, -1.0)).rgb;
  sum += texture2D(uTex, uv + r * vec2( 0.7,  0.7)).rgb;
  sum += texture2D(uTex, uv + r * vec2(-0.7,  0.7)).rgb;
  sum += texture2D(uTex, uv + r * vec2( 0.7, -0.7)).rgb;
  sum += texture2D(uTex, uv + r * vec2(-0.7, -0.7)).rgb;
  sum += texture2D(uTex, uv + r * vec2( 0.35,  0.35)).rgb * 1.5;
  sum += texture2D(uTex, uv + r * vec2(-0.35,  0.35)).rgb * 1.5;
  sum += texture2D(uTex, uv + r * vec2( 0.35, -0.35)).rgb * 1.5;
  sum += texture2D(uTex, uv + r * vec2(-0.35, -0.35)).rgb * 1.5;
  return sum / 16.0;
}

float vignetteAt(vec2 uv, float strength) {
  vec2 v = (uv - 0.5) * 2.0;
  return clamp(1.0 - dot(v, v) * strength, 0.0, 1.0);
}

float bayer2(vec2 p) {
  p = floor(p);
  return fract(p.x / 2.0 + p.y * p.y * 0.75);
}
float bayer4(vec2 p) {
  return bayer2(0.5 * p) * 0.25 + bayer2(p);
}
`;

const FRAGMENT_MAIN = `
void main() {
  vec3 rgb = look(vTexCoord) + uBrightness;
  rgb = (rgb - 0.5) * uContrast + 0.5;
  rgb = mix(vec3(lumaOf(rgb)), rgb, uSaturation);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;

const LOOK_SOURCES: Record<VideoShaderPresetId, string> = {
  none: `
vec3 look(vec2 uv) {
  return frameAt(uv);
}
`,
  custom: `
vec3 look(vec2 uv) {
  return frameAt(uv);
}
`,
  vivid: `
vec3 look(vec2 uv) {
  vec3 rgb = frameAt(uv);
  float rich = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
  rgb = mix(vec3(lumaOf(rgb)), rgb, 1.0 + 0.6 * (1.0 - rich));
  return mix(rgb, smoothstep(0.0, 1.0, rgb), 0.3);
}
`,
  clarity: `
vec3 look(vec2 uv) {
  vec3 rgb = frameAt(uv);
  float l = lumaOf(rgb);
  float detail = l - lumaOf(softAt(uv, 0.03));
  rgb += detail * 0.85 * (0.3 + 2.8 * l * (1.0 - l));
  return mix(vec3(lumaOf(rgb)), rgb, 1.1);
}
`,
  film: `
vec3 look(vec2 uv) {
  vec3 rgb = frameAt(uv);
  float l = lumaOf(rgb);
  rgb = mix(rgb + vec3(-0.01, 0.035, 0.07) * (1.0 - l), rgb * vec3(1.07, 0.99, 0.88), l);
  rgb = mix(rgb, smoothstep(0.0, 1.0, rgb), 0.55);
  rgb = rgb * 0.97 + 0.02;
  vec2 cell = uv * max(uResolution, vec2(1.0)) * 0.75 + vec2(uTime * 17.0, uTime * 23.0);
  rgb += (hash(cell) - 0.5) * 0.05 * (1.0 - abs(l - 0.5) * 1.5);
  return rgb * vignetteAt(uv, 0.22);
}
`,
  noir: `
vec3 look(vec2 uv) {
  float l = dot(frameAt(uv), vec3(0.45, 0.45, 0.10));
  l = mix(l, smoothstep(0.0, 1.0, l), 0.8);
  vec2 cell = uv * max(uResolution, vec2(1.0)) * 0.8 + vec2(uTime * 19.0, uTime * 29.0);
  l += (hash(cell) - 0.5) * 0.06;
  return vec3(l) * vignetteAt(uv, 0.36);
}
`,
  anime: `
vec3 look(vec2 uv) {
  vec2 px = 1.25 / max(uResolution, vec2(1.0));
  vec3 rgb = frameAt(uv);
  vec3 around = (texture2D(uTex, uv + vec2(px.x, 0.0)).rgb
    + texture2D(uTex, uv - vec2(px.x, 0.0)).rgb
    + texture2D(uTex, uv + vec2(0.0, px.y)).rgb
    + texture2D(uTex, uv - vec2(0.0, px.y)).rgb) * 0.25;
  float line = smoothstep(0.015, 0.16, lumaOf(around) - lumaOf(rgb));
  rgb += (rgb - around) * 0.55;
  rgb *= 1.0 - 0.4 * line;
  return mix(vec3(lumaOf(rgb)), rgb, 1.16);
}
`,
  neon: `
vec3 look(vec2 uv) {
  vec3 rgb = frameAt(uv);
  float l = smoothstep(0.02, 0.95, lumaOf(rgb));
  vec3 low = vec3(0.07, 0.02, 0.30);
  vec3 mid = vec3(0.92, 0.12, 0.62);
  vec3 high = vec3(0.35, 0.95, 1.0);
  vec3 tone = l < 0.5 ? mix(low, mid, l * 2.0) : mix(mid, high, l * 2.0 - 1.0);
  rgb = mix(rgb, tone, 0.55);
  return mix(rgb, smoothstep(0.0, 1.0, rgb), 0.4);
}
`,
  dream: `
vec3 look(vec2 uv) {
  vec3 rgb = frameAt(uv);
  vec3 soft = softAt(uv, 0.035);
  vec3 glow = soft * soft * 0.6;
  rgb = 1.0 - (1.0 - rgb) * (1.0 - glow);
  rgb = mix(rgb, soft, 0.28);
  rgb = mix(rgb, smoothstep(0.0, 1.0, rgb), 0.45);
  return rgb * vec3(1.03, 1.0, 1.02);
}
`,
  vintage: `
vec3 look(vec2 uv) {
  float tick = floor(uTime * 18.0);
  uv += (vec2(hash(vec2(tick, 1.0)), hash(vec2(tick, 2.0))) - 0.5) * 0.004;
  vec3 rgb = texture2D(uTex, uv).rgb;
  float l = lumaOf(rgb);
  rgb = mix(rgb, l * vec3(1.12, 0.93, 0.68), 0.62);
  rgb = rgb * 0.84 + 0.08;
  rgb *= 0.93 + 0.07 * hash(vec2(tick, 3.0));
  rgb += (hash(uv * max(uResolution, vec2(1.0)) * 0.6 + tick) - 0.5) * 0.10;
  for (int i = 0; i < 2; i++) {
    float seed = tick + float(i) * 7.0;
    float there = step(0.55, hash(vec2(seed, 4.0)));
    float off = abs(uv.x - hash(vec2(seed, 5.0)));
    rgb += there * (1.0 - smoothstep(0.0, 0.0012, off)) * 0.22;
  }
  return rgb * vignetteAt(uv, 0.42);
}
`,
  vhs: `
vec3 look(vec2 uv) {
  float row = floor(uv.y * 240.0);
  float field = floor(uTime * 30.0);
  uv.x += (hash(vec2(row, field)) - 0.5) * 0.0016;
  float along = fract(uv.y + uTime * 0.11);
  float band = smoothstep(0.0, 0.015, along) * (1.0 - smoothstep(0.03, 0.05, along));
  uv.x += band * (hash(vec2(row, field + 9.0)) - 0.5) * 0.035;
  float foot = 1.0 - smoothstep(0.0, 0.025, uv.y);
  uv.x += foot * (0.02 + (hash(vec2(row, field + 5.0)) - 0.5) * 0.04);

  vec3 here = texture2D(uTex, uv).rgb;
  vec3 smear = (here
    + texture2D(uTex, uv + vec2(0.0035, 0.0)).rgb
    + texture2D(uTex, uv + vec2(0.0070, 0.0)).rgb
    + texture2D(uTex, uv - vec2(0.0035, 0.0)).rgb
    + texture2D(uTex, uv - vec2(0.0070, 0.0)).rgb) * 0.2;
  float l = mix(lumaOf(here), lumaOf(smear), 0.35);
  vec3 rgb = vec3(l) + (smear - lumaOf(smear)) * 1.15;

  rgb += (hash(uv * 300.0 + uTime) - 0.5) * 0.07;
  rgb += (band + foot) * (hash(vec2(row * 3.0, uv.x * 40.0 + uTime)) - 0.35) * 0.22;
  return (rgb * 0.9 + 0.05) * vec3(1.03, 1.0, 0.95);
}
`,
  crt: `
vec3 look(vec2 uv) {
  vec2 c = (uv - 0.5) * 2.1;
  vec2 p = c * (1.0 + pow(abs(c.yx) * 0.16, vec2(2.0))) * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec3(0.0);
  vec3 rgb = vec3(
    texture2D(uTex, p + vec2(0.0016, 0.0)).r,
    texture2D(uTex, p).g,
    texture2D(uTex, p - vec2(0.0016, 0.0)).b);
  float beam = sin(scanlinesAt(p.y)) * 0.5 + 0.5;
  rgb *= mix(0.62 + 0.38 * beam, 1.0, lumaOf(rgb) * 0.6) * 1.12;
  float bar = fract(p.y - uTime * 0.07);
  rgb *= 1.0 + 0.05 * (1.0 - smoothstep(0.0, 0.12, bar));
  float corners = p.x * p.y * (1.0 - p.x) * (1.0 - p.y) * 16.0;
  return rgb * clamp(pow(corners, 0.22), 0.0, 1.0);
}
`,
  pixel: `
vec3 look(vec2 uv) {
  vec2 res = max(uResolution, vec2(1.0));
  float across = min(res.x, 160.0);
  vec2 cell = vec2(1.0 / across, res.x / (across * res.y));
  vec2 index = floor(uv / cell);
  vec3 rgb = texture2D(uTex, (index + 0.5) * cell).rgb;
  rgb = mix(vec3(lumaOf(rgb)), rgb, 1.25);
  return floor(rgb * 5.0 + 0.5 + (bayer4(index) - 0.47) * 0.4) / 5.0;
}
`,
  comic: `
vec3 look(vec2 uv) {
  vec2 res = max(uResolution, vec2(1.0));
  vec3 rgb = frameAt(uv);
  float l = lumaOf(rgb);
  float stepped = (floor(l * 4.0 + 0.5) + 0.35) / 4.35;
  rgb = mix(vec3(l), rgb, 1.5) * (stepped / max(l, 0.02));
  vec2 g = vec2(uv.x * res.x / res.y, uv.y) * min(res.y * 0.25, 130.0);
  g = vec2(g.x - g.y, g.x + g.y) * 0.7071;
  float dotSize = sqrt(clamp(0.62 - l, 0.0, 1.0)) * 0.7;
  float dots = 1.0 - smoothstep(dotSize - 0.08, dotSize + 0.08, length(fract(g) - 0.5));
  rgb *= 1.0 - 0.28 * dots;
  float ink = smoothstep(0.26, 0.42, edgeAt(uv, 1.5));
  return mix(rgb, vec3(0.05, 0.04, 0.07), ink);
}
`,
  sketch: `
vec3 look(vec2 uv) {
  vec2 res = max(uResolution, vec2(1.0));
  float l = dot(texture2D(uTex, uv).rgb, vec3(0.299, 0.587, 0.114));
  float paper = 1.0 - smoothstep(0.04, 0.4, edgeAt(uv, 1.2)) * 0.9;
  vec2 p = vec2(uv.x * res.x / res.y, uv.y) * min(res.y * 0.5, 300.0);
  float stroke = sin((p.x + p.y) * 2.2) * 0.5 + 0.5;
  float crossed = sin((p.x - p.y) * 2.2) * 0.5 + 0.5;
  paper -= (1.0 - smoothstep(0.3, 0.72, l)) * stroke * 0.36;
  paper -= (1.0 - smoothstep(0.08, 0.38, l)) * crossed * 0.34;
  paper += (hash(uv * res) - 0.5) * 0.04;
  return mix(vec3(0.17, 0.17, 0.21), vec3(0.96, 0.95, 0.91), clamp(paper, 0.0, 1.0));
}
`,
  night_vision: `
vec3 look(vec2 uv) {
  float l = dot(texture2D(uTex, uv).rgb, vec3(0.299, 0.587, 0.114));
  float flare = lumaOf(softAt(uv, 0.02));
  l = pow(l, 0.7) * 1.3 + flare * flare * 0.35;
  l += (hash(uv * 400.0 + uTime * 8.0) - 0.5) * 0.16;
  l *= 0.9 + 0.1 * sin(scanlinesAt(uv.y));
  return vec3(0.10, 1.0, 0.30) * l * vignetteAt(uv, 0.55);
}
`
};

/**
 * Validates a custom GLSL fragment shader on a throwaway WebGL context,
 * matching Koda's `VideoShaderValidator.check(fragmentSource)`.
 * Returns null if valid, or the GLSL compiler/linker error string if invalid.
 */
export function validateCustomFragmentShader(fragmentSource: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return null;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return null;

    try {
      gl.shaderSource(fs, fragmentSource);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        return (gl.getShaderInfoLog(fs) || 'Fragment shader failed to compile.').trim();
      }

      gl.shaderSource(vs, VERTEX_SHADER);
      gl.compileShader(vs);
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        return (gl.getProgramInfoLog(prog) || 'Shader program failed to link.').trim();
      }
      return null;
    } finally {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    }
  } catch {
    return null;
  }
}

/**
 * Computes the CSS + SVG filter string applied directly to the <video> element
 * when the video stream is cross-origin (CORS-restricted for WebGL texImage2D),
 * ensuring all 16 Koda presets and all 4 picture sliders work on every stream.
 */
export function buildCssVideoFilter(settings: VideoShaderSettings, webglActive: boolean): string {
  if (!isShaderEffectActive(settings) || webglActive) {
    return 'none';
  }

  const presetMeta = getPresetMeta(settings.activePreset);
  const effectiveSharpness = presetMeta.sharpens ? settings.sharpness : 0;

  // Base picture adjustments from sliders
  let brightness = 1 + settings.brightness;
  let contrast = settings.contrast;
  let saturate = settings.saturation;
  const parts: string[] = [];

  if (effectiveSharpness > 0.01) {
    parts.push('url(#koda-cas-sharpen-filter)');
  }

  switch (settings.activePreset) {
    case 'vivid':
      saturate *= 1.38;
      contrast *= 1.12;
      brightness *= 1.02;
      break;
    case 'clarity':
      parts.push('url(#koda-clarity-filter)');
      contrast *= 1.18;
      saturate *= 1.1;
      break;
    case 'film':
      parts.push('url(#koda-film-grade-filter)');
      contrast *= 1.14;
      saturate *= 0.94;
      break;
    case 'noir':
      parts.push('url(#koda-noir-filter)');
      contrast *= 1.35;
      brightness *= 0.96;
      break;
    case 'anime':
      parts.push('url(#koda-anime-filter)');
      saturate *= 1.24;
      contrast *= 1.12;
      break;
    case 'neon':
      parts.push('url(#koda-neon-filter)');
      saturate *= 1.45;
      contrast *= 1.2;
      break;
    case 'dream':
      parts.push('url(#koda-dream-bloom-filter)');
      brightness *= 1.05;
      contrast *= 1.06;
      break;
    case 'vintage':
      parts.push('sepia(0.62)');
      contrast *= 0.92;
      brightness *= 0.96;
      saturate *= 0.82;
      break;
    case 'vhs':
      parts.push('url(#koda-vhs-chroma-filter)');
      saturate *= 1.22;
      contrast *= 0.95;
      break;
    case 'crt':
      parts.push('url(#koda-crt-aberration-filter)');
      contrast *= 1.16;
      saturate *= 1.12;
      brightness *= 1.05;
      break;
    case 'pixel':
      parts.push('url(#koda-pixel-quantize-filter)');
      saturate *= 1.25;
      contrast *= 1.18;
      break;
    case 'comic':
      parts.push('url(#koda-comic-ink-filter)');
      saturate *= 1.45;
      contrast *= 1.25;
      break;
    case 'sketch':
      parts.push('url(#koda-sketch-paper-filter)');
      break;
    case 'night_vision':
      parts.push('url(#koda-night-vision-filter)');
      brightness *= 1.18;
      contrast *= 1.25;
      break;
    case 'custom': {
      const src = settings.customShaderSource.toLowerCase();
      if (src.includes('1.0 - color.rgb')) {
        parts.push('invert(1)');
      } else if (src.includes('sepia') || src.includes('0.299, 0.587')) {
        parts.push('sepia(0.85)');
      } else if (src.includes('edge')) {
        parts.push('url(#koda-edge-glow-filter)');
      }
      break;
    }
    default:
      break;
  }

  if (Math.abs(brightness - 1) > 0.005) {
    parts.push(`brightness(${brightness.toFixed(3)})`);
  }
  if (Math.abs(contrast - 1) > 0.005) {
    parts.push(`contrast(${contrast.toFixed(3)})`);
  }
  if (Math.abs(saturate - 1) > 0.005 && settings.activePreset !== 'noir' && settings.activePreset !== 'sketch') {
    parts.push(`saturate(${saturate.toFixed(3)})`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

interface KodaVideoShaderCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  onWebglStateChange?: (active: boolean) => void;
}

export const KodaVideoShaderCanvas: React.FC<KodaVideoShaderCanvasProps> = ({
  videoRef,
  isPlaying,
  onWebglStateChange
}) => {
  const settings = useVideoShaderStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [corsBlocked, setCorsBlocked] = useState(false);

  const effectActive = isShaderEffectActive(settings);
  const presetMeta = getPresetMeta(settings.activePreset);
  const effectiveSharpness = presetMeta.sharpens ? settings.sharpness : 0;

  // Compute 5-tap contrast-adaptive sharpen kernel center weight for SVG filter fallback
  const neighborWeight = -(0.28 * effectiveSharpness);
  const centerWeight = 1 + 4 * (0.28 * effectiveSharpness);
  const kernelMatrix = [
    0, neighborWeight, 0,
    neighborWeight, centerWeight, neighborWeight,
    0, neighborWeight, 0
  ]
    .map((n) => n.toFixed(3))
    .join(' ');

  // Reset CORS block flag whenever the video src changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoadStart = () => {
      setCorsBlocked(false);
    };
    video.addEventListener('loadstart', handleLoadStart);
    return () => video.removeEventListener('loadstart', handleLoadStart);
  }, [videoRef]);

  useEffect(() => {
    onWebglStateChange?.(effectActive && !corsBlocked);
  }, [effectActive, corsBlocked, onWebglStateChange]);

  // Primary WebGL Shader Pipeline (runs when effectActive && !corsBlocked)
  useEffect(() => {
    if (!effectActive || corsBlocked) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl =
      canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      setCorsBlocked(true);
      return;
    }

    const fragmentSource =
      settings.activePreset === 'custom'
        ? settings.customShaderSource
        : FRAGMENT_HEADER + (LOOK_SOURCES[settings.activePreset] || LOOK_SOURCES.none) + FRAGMENT_MAIN;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    gl.useProgram(program);

    // Quad geometry
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aFramePosition = gl.getAttribLocation(program, 'aFramePosition');
    if (aFramePosition >= 0) {
      gl.enableVertexAttribArray(aFramePosition);
      gl.vertexAttribPointer(aFramePosition, 2, gl.FLOAT, false, 0, 0);
    }

    // Video frame texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uTex = gl.getUniformLocation(program, 'uTex');
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uSharpness = gl.getUniformLocation(program, 'uSharpness');
    const uContrast = gl.getUniformLocation(program, 'uContrast');
    const uBrightness = gl.getUniformLocation(program, 'uBrightness');
    const uSaturation = gl.getUniformLocation(program, 'uSaturation');

    let rafId = 0;
    let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const startTime = performance.now();

    const scheduleNextFrame = () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (document.hidden) {
        idleTimeoutId = setTimeout(() => {
          rafId = requestAnimationFrame(renderFrame);
        }, 500);
      } else if (!v || (v.paused && !v.seeking)) {
        // While paused, poll gently at ~4fps so live shader slider tweaks still preview without burning 60fps GPU
        idleTimeoutId = setTimeout(() => {
          rafId = requestAnimationFrame(renderFrame);
        }, 250);
      } else {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const renderFrame = () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !document.hidden) {
        if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        try {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
        } catch {
          // Cross-origin video stream blocked texImage2D; switch seamlessly to SVG+Overlay engine
          setCorsBlocked(true);
          return;
        }

        gl.useProgram(program);
        if (uTex) gl.uniform1i(uTex, 0);
        if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);
        if (uTime) {
          const elapsedSec = ((performance.now() - startTime) % 3_600_000) / 1000;
          gl.uniform1f(uTime, elapsedSec);
        }
        const state = useVideoShaderStore.getState();
        const meta = getPresetMeta(state.activePreset);
        if (uSharpness) gl.uniform1f(uSharpness, meta.sharpens ? state.sharpness : 0);
        if (uContrast) gl.uniform1f(uContrast, state.contrast);
        if (uBrightness) gl.uniform1f(uBrightness, state.brightness);
        if (uSaturation) gl.uniform1f(uSaturation, state.saturation);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      scheduleNextFrame();
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelled = true;
      if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
      cancelAnimationFrame(rafId);
      gl.deleteTexture(texture);
      gl.deleteBuffer(posBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [
    effectActive,
    corsBlocked,
    settings.activePreset,
    settings.customShaderSource,
    videoRef
  ]);

  if (!effectActive) return null;

  return (
    <>
      {/* Hidden SVG Filter Pipeline for zero-CORS hardware-accelerated shader grading */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          {/* Contrast-Adaptive 5-tap Sharpening */}
          <filter id="koda-cas-sharpen-filter" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3 3"
              kernelMatrix={kernelMatrix}
              preserveAlpha="true"
            />
          </filter>

          {/* Clarity: Local Midtone Contrast Boost */}
          <filter id="koda-clarity-filter" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3 3"
              kernelMatrix="0 -0.18 0 -0.18 1.72 -0.18 0 -0.18 0"
              preserveAlpha="true"
            />
          </filter>

          {/* Film: Teal Shadows & Warm Kodak Highlights + Lifted Print Blacks */}
          <filter id="koda-film-grade-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="
                1.06  0.01 -0.02  0  0.015
                0.00  1.01  0.02  0  0.020
               -0.03  0.03  0.94  0  0.035
                0     0     0     1  0"
            />
          </filter>

          {/* Noir: Red-Filter Weighted Monochrome (0.45 R, 0.45 G, 0.10 B) */}
          <filter id="koda-noir-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="
                0.45 0.45 0.10 0 -0.03
                0.45 0.45 0.10 0 -0.03
                0.45 0.45 0.10 0 -0.03
                0    0    0    1  0"
            />
          </filter>

          {/* Anime: Crisp Line-Art Unsharp Mask & Richer Cel Shading */}
          <filter id="koda-anime-filter" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3 3"
              kernelMatrix="0 -0.26 0 -0.26 2.04 -0.26 0 -0.26 0"
              preserveAlpha="true"
            />
          </filter>

          {/* Neon: Violet / Magenta / Cyan Ramp */}
          <filter id="koda-neon-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="
                1.10 -0.15  0.35  0  0.02
               -0.10  0.85  0.30  0 -0.02
                0.30  0.20  1.25  0  0.05
                0     0     0     1  0"
            />
          </filter>

          {/* Dream: Soft Highlight Screen Bloom */}
          <filter id="koda-dream-bloom-filter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feBlend in="SourceGraphic" in2="blur" mode="screen" result="bloom" />
            <feComposite in="bloom" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.42" k3="0.62" k4="0" />
          </filter>

          {/* VHS: Horizontal Chroma Smear */}
          <filter id="koda-vhs-chroma-filter" colorInterpolationFilters="sRGB">
            <feOffset in="SourceGraphic" dx="2.4" dy="0" result="rShift" />
            <feOffset in="SourceGraphic" dx="-2.4" dy="0" result="bShift" />
            <feColorMatrix
              in="rShift"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="rOnly"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="gOnly"
            />
            <feColorMatrix
              in="bShift"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="bOnly"
            />
            <feBlend in="rOnly" in2="gOnly" mode="screen" result="rg" />
            <feBlend in="rg" in2="bOnly" mode="screen" />
          </filter>

          {/* CRT: RGB Phosphor Triad Aberration */}
          <filter id="koda-crt-aberration-filter" colorInterpolationFilters="sRGB">
            <feOffset in="SourceGraphic" dx="1.5" dy="0" result="r" />
            <feOffset in="SourceGraphic" dx="-1.5" dy="0" result="b" />
            <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="go" />
            <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bo" />
            <feBlend in="ro" in2="go" mode="screen" result="rg" />
            <feBlend in="rg" in2="bo" mode="screen" />
          </filter>

          {/* Pixel: Retro Console Stepped Palette */}
          <filter id="koda-pixel-quantize-filter" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0.0 0.2 0.4 0.6 0.8 1.0" />
              <feFuncG type="discrete" tableValues="0.0 0.2 0.4 0.6 0.8 1.0" />
              <feFuncB type="discrete" tableValues="0.0 0.2 0.4 0.6 0.8 1.0" />
            </feComponentTransfer>
          </filter>

          {/* Comic: 5-Step Stepped Print + Ink Edge */}
          <filter id="koda-comic-ink-filter" colorInterpolationFilters="sRGB">
            <feComponentTransfer result="stepped">
              <feFuncR type="discrete" tableValues="0.08 0.3 0.55 0.78 1.0" />
              <feFuncG type="discrete" tableValues="0.08 0.3 0.55 0.78 1.0" />
              <feFuncB type="discrete" tableValues="0.08 0.3 0.55 0.78 1.0" />
            </feComponentTransfer>
            <feConvolveMatrix
              in="stepped"
              order="3 3"
              kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0"
              preserveAlpha="true"
            />
          </filter>

          {/* Sketch: Graphite Edge Extraction on Warm Paper */}
          <filter id="koda-sketch-paper-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feConvolveMatrix
              in="gray"
              order="3 3"
              kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
              result="edges"
            />
            <feColorMatrix
              in="edges"
              type="matrix"
              values="
               -1.4  0    0    0  0.96
                0   -1.4  0    0  0.95
                0    0   -1.4  0  0.91
                0    0    0    1  0"
            />
          </filter>

          {/* Night Vision: Green Phosphor Image Intensifier */}
          <filter id="koda-night-vision-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="
                0.04 0.08 0.02 0 0
                0.35 0.82 0.18 0 0.03
                0.08 0.18 0.04 0 0
                0    0    0    1 0"
            />
          </filter>

          {/* Custom Edge Glow */}
          <filter id="koda-edge-glow-filter" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3 3"
              kernelMatrix="-0.5 -0.5 -0.5 -0.5 5.0 -0.5 -0.5 -0.5 -0.5"
              preserveAlpha="true"
            />
          </filter>
        </defs>
      </svg>

      {/* Direct WebGL Canvas when stream is CORS-clean */}
      {!corsBlocked && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: settings.zoomToFill ? 'cover' : 'contain',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
      )}

      {/* Procedural Post-FX Overlay Layer when running in zero-CORS SVG filter mode */}
      {corsBlocked && (
        <KodaProceduralShaderOverlay preset={settings.activePreset} />
      )}
    </>
  );
};

/**
 * Renders the physical medium overlays (CRT curved scanlines + tube bezel,
 * VHS rolling tracking band + head-switching noise, Film/Noir/Vintage grain & vignette,
 * Comic halftone dots, Pixel grid, Night Vision phosphor tube) when the video
 * element itself is graded via the SVG filter graph.
 */
const KodaProceduralShaderOverlay: React.FC<{ preset: VideoShaderPresetId }> = ({ preset }) => {
  if (
    preset === 'none' ||
    preset === 'vivid' ||
    preset === 'clarity' ||
    preset === 'anime'
  ) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
        ...(preset === 'crt'
          ? {
              background:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px, transparent 1px, transparent 3px), radial-gradient(circle at center, transparent 58%, rgba(0,0,0,0.78) 100%)',
              boxShadow: 'inset 0 0 48px rgba(0,0,0,0.85)',
              borderRadius: '18px'
            }
          : preset === 'vhs'
            ? {
                background:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px), linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 48%, transparent 52%, rgba(255,255,255,0.12) 97%, rgba(0,0,0,0.5) 100%)'
              }
            : preset === 'film' || preset === 'noir'
              ? {
                  background:
                    preset === 'noir'
                      ? 'radial-gradient(circle at center, transparent 48%, rgba(0,0,0,0.62) 100%)'
                      : 'radial-gradient(circle at center, transparent 58%, rgba(0,0,0,0.38) 100%)'
                }
              : preset === 'vintage'
                ? {
                    background:
                      'radial-gradient(circle at center, rgba(255,230,185,0.08) 40%, rgba(20,12,4,0.68) 100%)',
                    boxShadow: 'inset 0 0 60px rgba(0,0,0,0.65)'
                  }
                : preset === 'night_vision'
                  ? {
                      background:
                        'repeating-linear-gradient(0deg, rgba(0,25,8,0.28) 0px, rgba(0,25,8,0.28) 1px, transparent 1px, transparent 3px), radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.88) 100%)'
                    }
                  : preset === 'comic'
                    ? {
                        backgroundImage:
                          'radial-gradient(rgba(0,0,0,0.22) 1px, transparent 1.5px)',
                        backgroundSize: '6px 6px'
                      }
                    : preset === 'pixel'
                      ? {
                          backgroundImage:
                            'linear-gradient(to right, rgba(0,0,0,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.18) 1px, transparent 1px)',
                          backgroundSize: '4px 4px'
                        }
                      : preset === 'neon'
                        ? {
                            background:
                              'radial-gradient(circle at 50% 50%, rgba(235, 30, 158, 0.12), rgba(18, 5, 76, 0.35))',
                            mixBlendMode: 'screen'
                          }
                        : preset === 'dream'
                          ? {
                              background:
                                'radial-gradient(circle at 50% 40%, rgba(255,245,255,0.14), transparent 75%)',
                              mixBlendMode: 'screen'
                            }
                          : {
                              background:
                                'radial-gradient(circle at center, transparent 52%, rgba(0,0,0,0.5) 100%)'
                            })
      }}
    />
  );
};
