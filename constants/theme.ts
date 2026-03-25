//@ts-nocheck
import { Platform } from 'react-native';

export const Colors = {
  // Core brand
  orange: '#E8640A',
  orangeDim: '#C4530A',
  orangeGlow: 'rgba(232, 100, 10, 0.15)',
  orangeSubtle: 'rgba(232, 100, 10, 0.08)',

  // Backgrounds (deep blue, almost black)
  bg: '#000106ff', // very deep navy blue
  bgCard: '#020617',
  bgElevated: '#020617',
  bgGlass: 'rgba(2, 6, 23, 0.85)',

  // Text
  textPrimary: '#F5F0EB',
  textSecondary: '#9D8F85',
  textMuted: '#5C504A',

  // UI
  border: 'rgba(232, 100, 10, 0.12)',
  borderStrong: 'rgba(232, 100, 10, 0.25)',
  success: '#27AE60',
  error: '#E74C3C',
  white: '#FFFFFF',
  green: '#27AE60',

  // Themes
  themes: {
    default: {
      name: 'Chen',
      accent: '#E8640A',
      bg: '#020617',
      glow: 'rgba(37, 99, 235, 0.15)',
    },
    lagosNight: {
      name: 'Lagos Night',
      accent: '#7C3AED',
      bg: '#08060F',
      glow: 'rgba(124, 58, 237, 0.15)',
    },
    harmattan: {
      name: 'Harmattan',
      accent: '#D4A017',
      bg: '#0F0D08',
      glow: 'rgba(212, 160, 23, 0.15)',
    },
    midnightAfro: {
      name: 'Midnight Afro',
      accent: '#00BFA5',
      bg: '#060F0D',
      glow: 'rgba(0, 191, 165, 0.15)',
    },
    atilolaRed: {
      name: 'Atilola Red',
      accent: '#E74C3C',
      bg: '#0F0706',
      glow: 'rgba(231, 76, 60, 0.15)',
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export type ThemeKey = keyof typeof Colors.themes;