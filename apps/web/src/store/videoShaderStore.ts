import { create } from 'zustand';

export type VideoShaderPresetId =
  | 'none'
  | 'vivid'
  | 'clarity'
  | 'film'
  | 'noir'
  | 'anime'
  | 'neon'
  | 'dream'
  | 'vintage'
  | 'vhs'
  | 'crt'
  | 'pixel'
  | 'comic'
  | 'sketch'
  | 'night_vision'
  | 'custom';

export interface VideoShaderPresetMeta {
  id: VideoShaderPresetId;
  title: string;
  description: string;
  /** Whether the Sharpen slider applies to this look (matches Koda VideoShaderPreset.sharpens). */
  sharpens: boolean;
  category: 'none' | 'grade' | 'medium' | 'custom';
}

export const VIDEO_SHADER_PRESETS: VideoShaderPresetMeta[] = [
  {
    id: 'none',
    title: 'Original',
    description: 'Untouched video frame',
    sharpens: true,
    category: 'none'
  },
  {
    id: 'vivid',
    title: 'Vivid',
    description: 'Vibrance boost that lifts muted tones while keeping skin natural',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'clarity',
    title: 'Clarity',
    description: 'Local midtone contrast that separates shapes like HDR',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'film',
    title: 'Film',
    description: 'Teal shadows, warm highlights, lifted blacks & organic grain',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'noir',
    title: 'Noir',
    description: 'Red-filter monochrome with deep shadows, grain & vignette',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'anime',
    title: 'Anime',
    description: 'Crisper ink line-art reconstruction and richer flat cel colors',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'neon',
    title: 'Neon',
    description: 'Violet, magenta and cyan luminance grade over live color',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'dream',
    title: 'Dream',
    description: 'Soft 13-tap highlight bloom with recovered shadow depth',
    sharpens: true,
    category: 'grade'
  },
  {
    id: 'vintage',
    title: 'Vintage',
    description: '18fps gate weave, sepia warmth, flicker & film scratches',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'vhs',
    title: 'VHS',
    description: 'Chroma smear, scanline jitter, rolling tracking band & head noise',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'crt',
    title: 'CRT',
    description: 'Curved glass tube, RGB phosphor triad, beam scanlines & bezel',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'pixel',
    title: 'Pixel',
    description: '160-column retro console blocks with 4x4 Bayer ordered dithering',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'comic',
    title: 'Comic',
    description: 'Stepped print colors, 45° halftone shadow dots & Sobel ink lines',
    sharpens: true,
    category: 'medium'
  },
  {
    id: 'sketch',
    title: 'Sketch',
    description: 'Graphite pencil edges with diagonal & cross-hatched shading on paper',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'night_vision',
    title: 'Night Vision',
    description: 'Green phosphor intensifier, highlight flare, sensor noise & tube ring',
    sharpens: false,
    category: 'medium'
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Your own GLSL fragment shader running per frame',
    sharpens: false,
    category: 'custom'
  }
];

export interface VideoShaderTemplate {
  id: string;
  title: string;
  source: string;
}

export const SHARPNESS_OFF = 0;
export const NEUTRAL_CONTRAST = 1;
export const NEUTRAL_BRIGHTNESS = 0;
export const NEUTRAL_SATURATION = 1;

export const SHARPNESS_RANGE: [number, number] = [0, 1];
export const CONTRAST_RANGE: [number, number] = [0.5, 1.5];
export const BRIGHTNESS_RANGE: [number, number] = [-0.4, 0.4];
export const SATURATION_RANGE: [number, number] = [0, 2];

export const DEFAULT_CUSTOM_SHADER = `// uTex         the video frame
// vTexCoord    where this pixel is in it, 0.0 to 1.0
// uResolution  the frame's size in pixels
// uTime        a clock in seconds, for anything that moves

precision highp float;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uTime;
varying vec2 vTexCoord;

void main() {
    vec4 color = texture2D(uTex, vTexCoord);

    // Darken toward the corners.
    vec2 fromCentre = vTexCoord - 0.5;
    color.rgb *= 1.0 - dot(fromCentre, fromCentre) * 0.45;

    gl_FragColor = color;
}`;

export const STARTER_SHADER_TEMPLATES: VideoShaderTemplate[] = [
  {
    id: 'vignette',
    title: 'Warm Vignette',
    source: `precision highp float;
uniform sampler2D uTex;
varying vec2 vTexCoord;

void main() {
    vec4 color = texture2D(uTex, vTexCoord);
    vec2 fromCentre = vTexCoord - 0.5;
    color.rgb *= clamp(1.0 - dot(fromCentre, fromCentre) * 0.7, 0.0, 1.0);
    color.r *= 1.08;
    color.b *= 0.94;
    gl_FragColor = color;
}`
  },
  {
    id: 'invert',
    title: 'Invert',
    source: `precision highp float;
uniform sampler2D uTex;
varying vec2 vTexCoord;

void main() {
    vec4 color = texture2D(uTex, vTexCoord);
    gl_FragColor = vec4(1.0 - color.rgb, color.a);
}`
  },
  {
    id: 'sepia',
    title: 'Sepia',
    source: `precision highp float;
uniform sampler2D uTex;
varying vec2 vTexCoord;

void main() {
    vec4 color = texture2D(uTex, vTexCoord);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 sepia = vec3(luma * 1.2, luma, luma * 0.8);
    gl_FragColor = vec4(clamp(sepia, 0.0, 1.0), color.a);
}`
  },
  {
    id: 'edge_glow',
    title: 'Edge Glow',
    source: `precision highp float;
uniform sampler2D uTex;
uniform vec2 uResolution;
varying vec2 vTexCoord;

void main() {
    vec2 texel = 1.5 / max(uResolution, vec2(1.0));
    vec3 here = texture2D(uTex, vTexCoord).rgb;
    vec3 right = texture2D(uTex, vTexCoord + vec2(texel.x, 0.0)).rgb;
    vec3 below = texture2D(uTex, vTexCoord + vec2(0.0, texel.y)).rgb;
    float edge = length(abs(here - right) + abs(here - below));
    gl_FragColor = vec4(mix(here, vec3(0.2, 0.9, 1.0), clamp(edge * 2.0, 0.0, 1.0)), 1.0);
}`
  },
  {
    id: 'wobble',
    title: 'Wave Wobble',
    source: `precision highp float;
uniform sampler2D uTex;
uniform float uTime;
varying vec2 vTexCoord;

void main() {
    vec2 uv = vTexCoord;
    uv.x += sin(uv.y * 20.0 + uTime * 4.0) * 0.01;
    gl_FragColor = texture2D(uTex, uv);
}`
  }
];

export interface VideoShaderSettings {
  masterEnabled: boolean;
  activePreset: VideoShaderPresetId;
  sharpness: number;
  contrast: number;
  brightness: number;
  saturation: number;
  customShaderSource: string;
  ambientGlowEnabled: boolean;
  zoomToFill: boolean;
  sponsorBlockEnabled: boolean;
  sponsorAutoSkip: boolean;
}

export interface VideoShaderStoreState extends VideoShaderSettings {
  setMasterEnabled: (enabled: boolean) => void;
  setActivePreset: (preset: VideoShaderPresetId) => void;
  setPictureValues: (values: Partial<Pick<VideoShaderSettings, 'sharpness' | 'contrast' | 'brightness' | 'saturation'>>) => void;
  resetPictureValues: () => void;
  setCustomShader: (source: string, activate?: boolean) => void;
  setAmbientGlowEnabled: (enabled: boolean) => void;
  setZoomToFill: (enabled: boolean) => void;
  setSponsorBlockEnabled: (enabled: boolean) => void;
  setSponsorAutoSkip: (enabled: boolean) => void;
}

const STORAGE_KEY = 'koda_video_shaders_v1';

const loadSavedSettings = (): Partial<VideoShaderSettings> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveSettings = (state: VideoShaderSettings) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        masterEnabled: state.masterEnabled,
        activePreset: state.activePreset,
        sharpness: state.sharpness,
        contrast: state.contrast,
        brightness: state.brightness,
        saturation: state.saturation,
        customShaderSource: state.customShaderSource,
        ambientGlowEnabled: state.ambientGlowEnabled,
        zoomToFill: state.zoomToFill,
        sponsorBlockEnabled: state.sponsorBlockEnabled,
        sponsorAutoSkip: state.sponsorAutoSkip
      })
    );
  } catch {}
};

export function isPictureNeutral(settings: Pick<VideoShaderSettings, 'sharpness' | 'contrast' | 'brightness' | 'saturation'>): boolean {
  return (
    Math.abs(settings.sharpness - SHARPNESS_OFF) < 0.005 &&
    Math.abs(settings.contrast - NEUTRAL_CONTRAST) < 0.005 &&
    Math.abs(settings.brightness - NEUTRAL_BRIGHTNESS) < 0.005 &&
    Math.abs(settings.saturation - NEUTRAL_SATURATION) < 0.005
  );
}

export function isShaderEffectActive(settings: VideoShaderSettings): boolean {
  return settings.masterEnabled && (settings.activePreset !== 'none' || !isPictureNeutral(settings));
}

export function getPresetMeta(id: VideoShaderPresetId): VideoShaderPresetMeta {
  return VIDEO_SHADER_PRESETS.find((p) => p.id === id) || VIDEO_SHADER_PRESETS[0];
}

const initial = loadSavedSettings();

export const useVideoShaderStore = create<VideoShaderStoreState>((set, get) => ({
  masterEnabled: initial.masterEnabled ?? true,
  activePreset: initial.activePreset ?? 'none',
  sharpness: initial.sharpness ?? SHARPNESS_OFF,
  contrast: initial.contrast ?? NEUTRAL_CONTRAST,
  brightness: initial.brightness ?? NEUTRAL_BRIGHTNESS,
  saturation: initial.saturation ?? NEUTRAL_SATURATION,
  customShaderSource: initial.customShaderSource ?? DEFAULT_CUSTOM_SHADER,
  ambientGlowEnabled: initial.ambientGlowEnabled ?? true,
  zoomToFill: initial.zoomToFill ?? false,
  sponsorBlockEnabled: initial.sponsorBlockEnabled ?? true,
  sponsorAutoSkip: initial.sponsorAutoSkip ?? true,

  setMasterEnabled: (enabled) => {
    set({ masterEnabled: enabled });
    saveSettings(get());
  },

  setActivePreset: (preset) => {
    set({ activePreset: preset, masterEnabled: true });
    saveSettings(get());
  },

  setPictureValues: (values) => {
    set((state) => ({
      ...values,
      masterEnabled: true,
      sharpness: values.sharpness !== undefined ? Math.max(0, Math.min(1, values.sharpness)) : state.sharpness,
      contrast: values.contrast !== undefined ? Math.max(0.5, Math.min(1.5, values.contrast)) : state.contrast,
      brightness: values.brightness !== undefined ? Math.max(-0.4, Math.min(0.4, values.brightness)) : state.brightness,
      saturation: values.saturation !== undefined ? Math.max(0, Math.min(2, values.saturation)) : state.saturation
    }));
    saveSettings(get());
  },

  resetPictureValues: () => {
    set({
      sharpness: SHARPNESS_OFF,
      contrast: NEUTRAL_CONTRAST,
      brightness: NEUTRAL_BRIGHTNESS,
      saturation: NEUTRAL_SATURATION
    });
    saveSettings(get());
  },

  setCustomShader: (source, activate = true) => {
    set((state) => ({
      customShaderSource: source,
      masterEnabled: true,
      activePreset: activate ? 'custom' : state.activePreset
    }));
    saveSettings(get());
  },

  setAmbientGlowEnabled: (enabled) => {
    set({ ambientGlowEnabled: enabled });
    saveSettings(get());
  },

  setZoomToFill: (enabled) => {
    set({ zoomToFill: enabled });
    saveSettings(get());
  },

  setSponsorBlockEnabled: (enabled) => {
    set({ sponsorBlockEnabled: enabled });
    saveSettings(get());
  },

  setSponsorAutoSkip: (enabled) => {
    set({ sponsorAutoSkip: enabled });
    saveSettings(get());
  }
}));
