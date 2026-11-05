import {
  Hct,
  SchemeTonalSpot,
  SchemeExpressive,
  SchemeVibrant,
  SchemeFruitSalad,
  SchemeMonochrome,
  MaterialDynamicColors,
  hexFromArgb,
  argbFromHex
} from '@material/material-color-utilities';

export interface AppPalette {
  id: string;
  name: string;
  category: 'Vibrant' | 'Pastel' | 'Aesthetic' | 'Earthy' | 'Moody' | 'Jewel & Mono';
  seedPrimary: string;
  seedSecondary: string;
  seedTertiary: string;
}

export type PaletteStyle = 'TONAL_SPOT' | 'EXPRESSIVE' | 'VIBRANT' | 'FRUIT_SALAD' | 'MONOCHROME';

export const APP_PALETTES: AppPalette[] = [
  // Vibrant
  { id: 'electric', name: 'Electric', category: 'Vibrant', seedPrimary: '#2F6BFF', seedSecondary: '#00C2FF', seedTertiary: '#7A5CFF' },
  { id: 'magenta', name: 'Magenta Pop', category: 'Vibrant', seedPrimary: '#FF2D95', seedSecondary: '#FF5CA8', seedTertiary: '#B14BFF' },
  { id: 'citrus', name: 'Citrus', category: 'Vibrant', seedPrimary: '#FF7A00', seedSecondary: '#FFB400', seedTertiary: '#B6D400' },
  { id: 'neon', name: 'Neon Lime', category: 'Vibrant', seedPrimary: '#00E676', seedSecondary: '#00E5C0', seedTertiary: '#3AD1FF' },

  // Pastel
  { id: 'lavender', name: 'Lavender Haze', category: 'Pastel', seedPrimary: '#B388FF', seedSecondary: '#CBA6FF', seedTertiary: '#FF9EE6' },
  { id: 'mint', name: 'Cotton Mint', category: 'Pastel', seedPrimary: '#66E0C0', seedSecondary: '#7FE3D0', seedTertiary: '#66D9E8' },
  { id: 'peach', name: 'Peach Sorbet', category: 'Pastel', seedPrimary: '#FFAB91', seedSecondary: '#FF8A80', seedTertiary: '#FFB2C0' },
  { id: 'sky', name: 'Baby Sky', category: 'Pastel', seedPrimary: '#7EC8FF', seedSecondary: '#90A8FF', seedTertiary: '#A6E3FF' },

  // Aesthetic
  { id: 'vintagefilm', name: 'Vintage Film', category: 'Aesthetic', seedPrimary: '#C6A15B', seedSecondary: '#9CAF88', seedTertiary: '#B08968' },
  { id: 'dustyrose', name: 'Dusty Rose', category: 'Aesthetic', seedPrimary: '#C58B96', seedSecondary: '#A99ABA', seedTertiary: '#CBA6A0' },
  { id: 'sagesand', name: 'Sage & Sand', category: 'Aesthetic', seedPrimary: '#9CAF88', seedSecondary: '#D8C3A5', seedTertiary: '#CB9273' },
  { id: 'fadeddenim', name: 'Faded Denim', category: 'Aesthetic', seedPrimary: '#7E9AAE', seedSecondary: '#94A7B2', seedTertiary: '#6E9B94' },
  { id: 'oatlatte', name: 'Oat Latte', category: 'Aesthetic', seedPrimary: '#C2A386', seedSecondary: '#D6C6B0', seedTertiary: '#A07E64' },
  { id: 'sunbleached', name: 'Sun-bleached', category: 'Aesthetic', seedPrimary: '#D79A87', seedSecondary: '#9CC0B3', seedTertiary: '#D9C4A3' },

  // Earthy
  { id: 'terracotta', name: 'Terracotta', category: 'Earthy', seedPrimary: '#E2725B', seedSecondary: '#C67B5C', seedTertiary: '#D9A066' },
  { id: 'forest', name: 'Forest', category: 'Earthy', seedPrimary: '#4C9A5B', seedSecondary: '#7A8B3C', seedTertiary: '#A6B04A' },
  { id: 'mocha', name: 'Mocha', category: 'Earthy', seedPrimary: '#A9745B', seedSecondary: '#C89B6E', seedTertiary: '#9E8B7D' },
  { id: 'autumn', name: 'Autumn', category: 'Earthy', seedPrimary: '#C1440E', seedSecondary: '#E08E0B', seedTertiary: '#D4A017' },

  // Moody
  { id: 'crimson', name: 'Crimson Noir', category: 'Moody', seedPrimary: '#E0114B', seedSecondary: '#FF3D57', seedTertiary: '#9C1B3E' },
  { id: 'indigo', name: 'Midnight Indigo', category: 'Moody', seedPrimary: '#3D3DE0', seedSecondary: '#5C6BC0', seedTertiary: '#7E57C2' },
  { id: 'deepteal', name: 'Deep Teal', category: 'Moody', seedPrimary: '#009688', seedSecondary: '#00BCD4', seedTertiary: '#4DB6AC' },
  { id: 'plum', name: 'Royal Plum', category: 'Moody', seedPrimary: '#8E24AA', seedSecondary: '#AB47BC', seedTertiary: '#E040FB' },

  // Jewel & Mono
  { id: 'emerald', name: 'Emerald', category: 'Jewel & Mono', seedPrimary: '#10B981', seedSecondary: '#34D399', seedTertiary: '#6EE7B7' },
  { id: 'ocean', name: 'Ocean', category: 'Jewel & Mono', seedPrimary: '#0077B6', seedSecondary: '#0096C7', seedTertiary: '#3A67C4' },
  { id: 'rosegold', name: 'Rose Gold', category: 'Jewel & Mono', seedPrimary: '#E18C8C', seedSecondary: '#E0B0A0', seedTertiary: '#D4AF37' },
  { id: 'graphite', name: 'Graphite', category: 'Jewel & Mono', seedPrimary: '#64748B', seedSecondary: '#94A3B8', seedTertiary: '#475569' },
  { id: 'black', name: 'Black', category: 'Jewel & Mono', seedPrimary: '#1a1a1a', seedSecondary: '#2b2b2b', seedTertiary: '#363636' },
  { id: 'white', name: 'White', category: 'Jewel & Mono', seedPrimary: '#f5f5f5', seedSecondary: '#e8e8e8', seedTertiary: '#d8d8d8' }
];

export const PALETTE_CATEGORIES = ['Vibrant', 'Pastel', 'Aesthetic', 'Earthy', 'Moody', 'Jewel & Mono'] as const;

export function findPalette(id: string): AppPalette | undefined {
  return APP_PALETTES.find((p) => p.id === id);
}

/**
 * Builds Material 3 Expressive CSS variables dictionary from palette and style
 */
export function buildPaletteTokens(
  palette: AppPalette,
  dark: boolean = true,
  style: PaletteStyle = 'TONAL_SPOT'
): Record<string, string> {
  const hct = Hct.fromInt(argbFromHex(palette.seedPrimary));
  let scheme;

  if (palette.id === 'black' || palette.id === 'white') {
    scheme = new SchemeMonochrome(hct, dark, 0);
  } else {
    switch (style) {
      case 'EXPRESSIVE':
        scheme = new SchemeExpressive(hct, dark, 0);
        break;
      case 'VIBRANT':
        scheme = new SchemeVibrant(hct, dark, 0);
        break;
      case 'FRUIT_SALAD':
        scheme = new SchemeFruitSalad(hct, dark, 0);
        break;
      case 'MONOCHROME':
        scheme = new SchemeMonochrome(hct, dark, 0);
        break;
      case 'TONAL_SPOT':
      default:
        scheme = new SchemeTonalSpot(hct, dark, 0);
        break;
    }
  }

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

  return tokens;
}

/**
 * Applies palette tokens directly to DOM documentElement
 */
export function applyPaletteTheme(
  palette: AppPalette,
  dark: boolean = true,
  style: PaletteStyle = 'TONAL_SPOT'
) {
  const tokens = buildPaletteTokens(palette, dark, style);
  const root = document.documentElement;
  for (const [key, val] of Object.entries(tokens)) {
    root.style.setProperty(key, val);
  }
}
