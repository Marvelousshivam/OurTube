import {
  sourceColorFromImage,
  Hct,
  SchemeExpressive,
  MaterialDynamicColors,
  hexFromArgb
} from '@material/material-color-utilities';
import { sizedArtwork } from '../api/artworkService';

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
 * Applies dynamic theme to document root from image
 */
export async function applyDynamicThemeFromImage(imageUrl: string, isDark: boolean = true) {
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    const seedColor = await sourceColorFromImage(img);
    if (!seedColor) return;

    const hct = Hct.fromInt(seedColor);
    const scheme = new SchemeExpressive(hct, isDark, 0);

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
      '--md-sys-color-surface': hexFromArgb(MaterialDynamicColors.surface.getArgb(scheme)),
      '--md-sys-color-on-surface': hexFromArgb(MaterialDynamicColors.onSurface.getArgb(scheme)),
      '--md-sys-color-surface-container-lowest': hexFromArgb(MaterialDynamicColors.surfaceContainerLowest.getArgb(scheme)),
      '--md-sys-color-surface-container-low': hexFromArgb(MaterialDynamicColors.surfaceContainerLow.getArgb(scheme)),
      '--md-sys-color-surface-container': hexFromArgb(MaterialDynamicColors.surfaceContainer.getArgb(scheme)),
      '--md-sys-color-surface-container-high': hexFromArgb(MaterialDynamicColors.surfaceContainerHigh.getArgb(scheme)),
      '--md-sys-color-surface-container-highest': hexFromArgb(MaterialDynamicColors.surfaceContainerHighest.getArgb(scheme)),
      '--md-sys-color-outline': hexFromArgb(MaterialDynamicColors.outline.getArgb(scheme)),
      '--md-sys-color-outline-variant': hexFromArgb(MaterialDynamicColors.outlineVariant.getArgb(scheme)),
      '--md-sys-color-background': hexFromArgb(MaterialDynamicColors.background.getArgb(scheme)),
      '--md-sys-color-on-background': hexFromArgb(MaterialDynamicColors.onBackground.getArgb(scheme))
    };

    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
  } catch (err) {
    console.warn('[Koda Dynamic Theme] Color extraction skipped:', err);
  }
}
