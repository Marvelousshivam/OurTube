/**
 * Material 3 Expressive (M3E) Design System Tokens for Koda Web
 * Based on Google Material 3 Expressive guidelines, Koda Android, and taste-skill principles.
 */

export const COLOR_TOKENS = {
  primary: 'var(--md-sys-color-primary)',
  onPrimary: 'var(--md-sys-color-on-primary)',
  primaryContainer: 'var(--md-sys-color-primary-container)',
  onPrimaryContainer: 'var(--md-sys-color-on-primary-container)',

  secondary: 'var(--md-sys-color-secondary)',
  onSecondary: 'var(--md-sys-color-on-secondary)',
  secondaryContainer: 'var(--md-sys-color-secondary-container)',
  onSecondaryContainer: 'var(--md-sys-color-on-secondary-container)',

  tertiary: 'var(--md-sys-color-tertiary)',
  onTertiary: 'var(--md-sys-color-on-tertiary)',
  tertiaryContainer: 'var(--md-sys-color-tertiary-container)',
  onTertiaryContainer: 'var(--md-sys-color-on-tertiary-container)',

  surface: 'var(--md-sys-color-surface)',
  onSurface: 'var(--md-sys-color-on-surface)',
  surfaceVariant: 'var(--md-sys-color-surface-variant, var(--md-sys-color-surface-container-high))',
  onSurfaceVariant: 'var(--md-sys-color-on-surface-variant, #c4c7c5)',

  surfaceContainerLowest: 'var(--md-sys-color-surface-container-lowest)',
  surfaceContainerLow: 'var(--md-sys-color-surface-container-low)',
  surfaceContainer: 'var(--md-sys-color-surface-container)',
  surfaceContainerHigh: 'var(--md-sys-color-surface-container-high)',
  surfaceContainerHighest: 'var(--md-sys-color-surface-container-highest)',

  outline: 'var(--md-sys-color-outline)',
  outlineVariant: 'var(--md-sys-color-outline-variant)',
  background: 'var(--md-sys-color-background)',
  onBackground: 'var(--md-sys-color-on-background)'
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
  huge: '64px'
} as const;

export const TYPOGRAPHY = {
  displayLarge: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    fontStyle: 'italic'
  },
  displayMedium: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    fontStyle: 'italic'
  },
  displaySmall: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.01em',
    fontStyle: 'italic'
  },
  headlineLarge: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.01em'
  },
  headlineMedium: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '1.5rem',
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: '-0.01em'
  },
  headlineSmall: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '1.25rem',
    fontWeight: 700,
    lineHeight: 1.3
  },
  titleLarge: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '1.125rem',
    fontWeight: 700,
    lineHeight: 1.35
  },
  titleMedium: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '0.9375rem',
    fontWeight: 600,
    lineHeight: 1.4
  },
  bodyLarge: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5
  },
  bodyMedium: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.45
  },
  labelLarge: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '0.875rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const
  },
  labelSmall: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '0.6875rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const
  }
} as const;

export const SHAPES = {
  circle: 'circle(50% at 50% 50%)',
  // 9-sided cookie for artist avatars
  cookie9Sided:
    'polygon(50% 0%, 82% 12%, 100% 41%, 93% 75%, 68% 97%, 32% 97%, 7% 75%, 0% 41%, 18% 12%)',
  // 12-sided cookie squircle
  cookie12Sided:
    'polygon(30% 0%, 70% 0%, 90% 10%, 100% 30%, 100% 70%, 90% 90%, 70% 100%, 30% 100%, 10% 90%, 0% 70%, 0% 30%, 10% 10%)',
  // 12-lobed scalloped flower die-cut (matching Koda)
  scallop12:
    'polygon(50% 0%, 61.1% 8.5%, 75% 6.7%, 80.4% 19.6%, 93.3% 25%, 91.5% 38.9%, 100% 50%, 91.5% 61.1%, 93.3% 75%, 80.4% 80.4%, 75% 93.3%, 61.1% 91.5%, 50% 100%, 38.9% 91.5%, 25% 93.3%, 19.6% 80.4%, 6.7% 75%, 8.5% 61.1%, 0% 50%, 8.5% 38.9%, 6.7% 25%, 19.6% 19.6%, 25% 6.7%, 38.9% 8.5%)',
  // Organic flower 8-petal
  flower:
    'polygon(50% 0%, 65% 10%, 80% 5%, 85% 20%, 100% 25%, 95% 40%, 100% 55%, 88% 68%, 95% 82%, 78% 88%, 70% 100%, 50% 90%, 30% 100%, 22% 88%, 5% 82%, 12% 68%, 0% 55%, 5% 40%, 0% 25%, 15% 20%, 20% 5%, 35% 10%)',
  // Arch
  arch: 'polygon(0% 25%, 25% 5%, 50% 0%, 75% 5%, 100% 25%, 100% 100%, 0% 100%)',
  // Diamond Gem
  gem: 'polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)',
  // Softburst 8-star for Liked badges
  softBurst:
    'polygon(50% 0%, 63% 15%, 85% 15%, 85% 37%, 100% 50%, 85% 63%, 85% 85%, 63% 85%, 50% 100%, 37% 85%, 15% 85%, 15% 63%, 0% 50%, 15% 37%, 15% 15%, 37% 15%)'
} as const;

export const MOTION = {
  fastSpatial: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
  springPress: 'scale(0.95)',
  durationShort: '150ms',
  durationMedium: '300ms',
  durationLong: '500ms'
} as const;
