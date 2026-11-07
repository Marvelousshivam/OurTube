import {
  sourceColorFromImage,
  Hct,
  SchemeTonalSpot,
  SchemeExpressive,
  SchemeVibrant,
  SchemeFruitSalad,
  SchemeMonochrome,
  MaterialDynamicColors,
  hexFromArgb
} from '@material/material-color-utilities';
import { sizedArtwork } from '../api/artworkService';
import { PaletteStyle } from './ColorPalettes';

export interface ExtractedAlbumColors {
  dominant: string;
  secondary: string;
  accent: string;
  tertiary: string;
  surface: string;
}

/**
 * Extracts 4 coordinated colors for Chromatic Mist and dynamic theming
 */
export async function extractPaletteFromImage(imageUrl: string): Promise<ExtractedAlbumColors> {
  return new Promise((resolve) => {
    const fallback: ExtractedAlbumColors = {
      dominant: '#23477c',
      secondary: '#3f4759',
      accent: '#a8c7fa',
      tertiary: '#573e5e',
      surface: '#111318'
    };

    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.referrerPolicy = 'no-referrer';
      img.src = sizedArtwork(imageUrl, 120);

      img.onload = async () => {
        try {
          const seedColor = await sourceColorFromImage(img);
          if (!seedColor) {
            resolve(fallback);
            return;
          }

          const hct = Hct.fromInt(seedColor);
          const scheme = new SchemeExpressive(hct, true, 0);

          resolve({
            dominant: hexFromArgb(MaterialDynamicColors.primaryContainer.getArgb(scheme)),
            secondary: hexFromArgb(MaterialDynamicColors.secondaryContainer.getArgb(scheme)),
            accent: hexFromArgb(MaterialDynamicColors.primary.getArgb(scheme)),
            tertiary: hexFromArgb(MaterialDynamicColors.tertiaryContainer.getArgb(scheme)),
            surface: hexFromArgb(MaterialDynamicColors.surfaceContainerLowest.getArgb(scheme))
          });
        } catch {
          resolve(fallback);
        }
      };

      img.onerror = () => {
        resolve(fallback);
      };
    } catch {
      resolve(fallback);
    }
  });
}

/**
 * Applies dynamic theme to document root from image, respecting active themeMode, AMOLED & PaletteStyle
 */
export async function applyDynamicThemeFromImage(imageUrl: string, forceDark?: boolean) {
  try {
    let themeMode = 'dark';
    let paletteStyle: PaletteStyle = 'TONAL_SPOT';
    try {
      const rawMode = localStorage.getItem('koda_theme_mode');
      if (rawMode) themeMode = JSON.parse(rawMode);
      const rawStyle = localStorage.getItem('koda_palette_style') as PaletteStyle;
      if (rawStyle) paletteStyle = rawStyle;
    } catch {}

    const isDark =
      forceDark !== undefined
        ? forceDark
        : themeMode === 'dark' ||
          themeMode === 'amoled' ||
          (themeMode === 'system' &&
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);
    const isAmoled = themeMode === 'amoled';

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = sizedArtwork(imageUrl, 120);

    const seedColor = await sourceColorFromImage(img);
    if (!seedColor) return;

    const hct = Hct.fromInt(seedColor);
    const scheme = (() => {
      switch (paletteStyle) {
        case 'EXPRESSIVE':
          return new SchemeExpressive(hct, isDark, 0);
        case 'VIBRANT':
          return new SchemeVibrant(hct, isDark, 0);
        case 'FRUIT_SALAD':
          return new SchemeFruitSalad(hct, isDark, 0);
        case 'MONOCHROME':
          return new SchemeMonochrome(hct, isDark, 0);
        case 'TONAL_SPOT':
        default:
          return new SchemeTonalSpot(hct, isDark, 0);
      }
    })();

    const root = document.documentElement;
    const tokens: Record<string, string> = {
      '--md-sys-color-primary': hexFromArgb(MaterialDynamicColors.primary.getArgb(scheme)),
      '--md-sys-color-on-primary': hexFromArgb(MaterialDynamicColors.onPrimary.getArgb(scheme)),
      '--md-sys-color-primary-container': hexFromArgb(MaterialDynamicColors.primaryContainer.getArgb(scheme)),
      '--md-sys-color-on-primary-container': hexFromArgb(MaterialDynamicColors.onPrimaryContainer.getArgb(scheme)),
      '--md-sys-color-secondary': hexFromArgb(MaterialDynamicColors.secondary.getArgb(scheme)),
      '--md-sys-color-on-secondary': hexFromArgb(MaterialDynamicColors.onSecondary.getArgb(scheme)),
      '--md-sys-color-secondary-container': hexFromArgb(MaterialDynamicColors.secondaryContainer.getArgb(scheme)),
      '--md-sys-color-on-secondary-container': hexFromArgb(MaterialDynamicColors.onSecondaryContainer.getArgb(scheme)),
      '--md-sys-color-tertiary': hexFromArgb(MaterialDynamicColors.tertiary.getArgb(scheme)),
      '--md-sys-color-on-tertiary': hexFromArgb(MaterialDynamicColors.onTertiary.getArgb(scheme)),
      '--md-sys-color-tertiary-container': hexFromArgb(MaterialDynamicColors.tertiaryContainer.getArgb(scheme)),
      '--md-sys-color-on-tertiary-container': hexFromArgb(MaterialDynamicColors.onTertiaryContainer.getArgb(scheme)),
      '--md-sys-color-surface': isAmoled ? '#000000' : hexFromArgb(MaterialDynamicColors.surface.getArgb(scheme)),
      '--md-sys-color-on-surface': hexFromArgb(MaterialDynamicColors.onSurface.getArgb(scheme)),
      '--md-sys-color-on-surface-variant': hexFromArgb(MaterialDynamicColors.onSurfaceVariant.getArgb(scheme)),
      '--md-sys-color-surface-container-lowest': isAmoled ? '#000000' : hexFromArgb(MaterialDynamicColors.surfaceContainerLowest.getArgb(scheme)),
      '--md-sys-color-surface-container-low': isAmoled ? '#070709' : hexFromArgb(MaterialDynamicColors.surfaceContainerLow.getArgb(scheme)),
      '--md-sys-color-surface-container': isAmoled ? '#0c0c10' : hexFromArgb(MaterialDynamicColors.surfaceContainer.getArgb(scheme)),
      '--md-sys-color-surface-container-high': isAmoled ? '#141418' : hexFromArgb(MaterialDynamicColors.surfaceContainerHigh.getArgb(scheme)),
      '--md-sys-color-surface-container-highest': isAmoled ? '#1c1c22' : hexFromArgb(MaterialDynamicColors.surfaceContainerHighest.getArgb(scheme)),
      '--md-sys-color-outline': hexFromArgb(MaterialDynamicColors.outline.getArgb(scheme)),
      '--md-sys-color-outline-variant': hexFromArgb(MaterialDynamicColors.outlineVariant.getArgb(scheme)),
      '--md-sys-color-background': isAmoled ? '#000000' : hexFromArgb(MaterialDynamicColors.background.getArgb(scheme)),
      '--md-sys-color-on-background': hexFromArgb(MaterialDynamicColors.onBackground.getArgb(scheme))
    };

    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
  } catch (err) {
    console.warn('[Koda Dynamic Theme] Color extraction skipped:', err);
  }
}
