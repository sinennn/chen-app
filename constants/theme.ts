//@ts-nocheck
import { Platform } from 'react-native';

type ThemeDefinition = {
  name: string;
  accent: string;
  bg: string;
  glow: string;
};

function normalizeHex(hex: string) {
  const value = hex.replace('#', '').trim();
  if (value.length === 3) {
    return value.split('').map((char) => `${char}${char}`).join('');
  }
  return value.padEnd(6, '0').slice(0, 6);
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function withAlpha(hex: string, alpha: number) {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function darkenHex(hex: string, amount: number) {
  const normalized = normalizeHex(hex);
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const r = clampByte(parseInt(normalized.slice(0, 2), 16) * factor);
  const g = clampByte(parseInt(normalized.slice(2, 4), 16) * factor);
  const b = clampByte(parseInt(normalized.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const ThemeDefinitions = {
  default: {
    name: 'Chen',
    accent: '#E8640A',
    //bg: '#020617',
    bg:"#000000",
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
} satisfies Record<string, ThemeDefinition>;

export type ThemeKey = keyof typeof ThemeDefinitions;
export const DEFAULT_THEME_KEY: ThemeKey = 'default';

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
  themes: ThemeDefinitions,
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

export function normalizeThemeKey(value?: string | null): ThemeKey {
  if (typeof value !== 'string') {
    return DEFAULT_THEME_KEY;
  }

  return (value in ThemeDefinitions ? value : DEFAULT_THEME_KEY) as ThemeKey;
}

export function applyTheme(themeKey: ThemeKey) {
  const theme = ThemeDefinitions[normalizeThemeKey(themeKey)];

  Colors.orange = theme.accent;
  Colors.orangeDim = darkenHex(theme.accent, 0.14);
  Colors.orangeGlow = withAlpha(theme.accent, 0.15);
  Colors.orangeSubtle = withAlpha(theme.accent, 0.08);
  Colors.bg = theme.bg;
  Colors.bgCard = darkenHex(theme.bg, 0.02);
  Colors.bgElevated = darkenHex(theme.bg, 0.01);
  Colors.bgGlass = withAlpha(theme.bg, 0.85);
  Colors.border = withAlpha(theme.accent, 0.12);
  Colors.borderStrong = withAlpha(theme.accent, 0.25);
}
