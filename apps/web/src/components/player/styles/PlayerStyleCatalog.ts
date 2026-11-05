import { PlayerStyle } from '../../../types';

export interface PlayerStyleInfo {
  style: PlayerStyle;
  label: string;
  subtitle: string;
  icon: string;
  shapeName: string;
}

export const PLAYER_STYLE_CATALOG: PlayerStyleInfo[] = [
  {
    style: 'EDITORIAL',
    label: 'Editorial',
    subtitle: 'Two-tone magazine layout with serif spread',
    icon: 'newspaper',
    shapeName: 'flower'
  },
  {
    style: 'CLASSIC',
    label: 'Classic',
    subtitle: 'Tactile circular scrubber with morphing controls',
    icon: 'play_circle',
    shapeName: 'circle'
  },
  {
    style: 'BENTO',
    label: 'Bento',
    subtitle: 'Squishy grid of flat tonal tiles with physical mass',
    icon: 'grid_view',
    shapeName: 'cookie'
  },
  {
    style: 'CANVAS',
    label: 'Canvas',
    subtitle: 'Full-bleed edge-sampled immersion',
    icon: 'wallpaper',
    shapeName: 'gem'
  },
  {
    style: 'GESTURE',
    label: 'Gesture',
    subtitle: 'Swipeable expansive artwork carousel',
    icon: 'swipe_right',
    shapeName: 'pill'
  },
  {
    style: 'HERO',
    label: 'Hero',
    subtitle: 'Full-bleed cover over tonal deck with morphing disc',
    icon: 'stars',
    shapeName: 'hero'
  },
  {
    style: 'MORPH',
    label: 'Morph',
    subtitle: 'Animated organic shape with wavy progress ring',
    icon: 'blur_on',
    shapeName: 'blob'
  },
  {
    style: 'DIAL',
    label: 'Dial',
    subtitle: '360° precision radial chronograph gauge',
    icon: 'speed',
    shapeName: 'dial'
  }
];
