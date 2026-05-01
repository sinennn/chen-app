//@ts-nocheck
import { Platform } from 'react-native';

type ThemeDefinition = {
  name: string;
  accent: string;
  accentSecondary: string;
  onAccent: string;
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgGlass: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  pageTop: string;
  pageMiddle: string;
  pageBottom: string;
  heroFrom: string;
  heroTo: string;
  tabBar: string;
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
    accentSecondary: '#F3B27C',
    onAccent: '#120904',
    bg: '#050404',
    bgCard: '#110C09',
    bgElevated: '#18100C',
    bgGlass: 'rgba(17, 12, 9, 0.82)',
    textPrimary: '#F8EEE7',
    textSecondary: '#C9B1A1',
    textMuted: '#7D665B',
    pageTop: '#25130A',
    pageMiddle: '#120907',
    pageBottom: '#050404',
    heroFrom: 'rgba(232, 100, 10, 0.22)',
    heroTo: 'rgba(243, 178, 124, 0.05)',
    tabBar: '#0B0706',
    glow: 'rgba(232, 100, 10, 0.18)',
  },
  lagosNight: {
    name: 'Lagos Night',
    accent: '#8B5CF6',
    accentSecondary: '#56CCF2',
    onAccent: '#F7F4FF',
    bg: '#060713',
    bgCard: '#10132B',
    bgElevated: '#171B3B',
    bgGlass: 'rgba(16, 19, 43, 0.82)',
    textPrimary: '#F2F4FF',
    textSecondary: '#B5BDE9',
    textMuted: '#6C76A8',
    pageTop: '#1A1740',
    pageMiddle: '#0E1231',
    pageBottom: '#060713',
    heroFrom: 'rgba(139, 92, 246, 0.2)',
    heroTo: 'rgba(86, 204, 242, 0.08)',
    tabBar: '#0A0C1F',
    glow: 'rgba(139, 92, 246, 0.2)',
  },
  harmattan: {
    name: 'Harmattan',
    accent: '#D4A017',
    accentSecondary: '#EED9A3',
    onAccent: '#18120A',
    bg: '#0C0907',
    bgCard: '#1A1510',
    bgElevated: '#241E16',
    bgGlass: 'rgba(26, 21, 16, 0.82)',
    textPrimary: '#F7F1E2',
    textSecondary: '#D9C5A0',
    textMuted: '#8D775B',
    pageTop: '#2A2217',
    pageMiddle: '#16120C',
    pageBottom: '#0C0907',
    heroFrom: 'rgba(212, 160, 23, 0.18)',
    heroTo: 'rgba(238, 217, 163, 0.07)',
    tabBar: '#14100B',
    glow: 'rgba(212, 160, 23, 0.18)',
  },
  midnightAfro: {
    name: 'Midnight Afro',
    accent: '#00BFA5',
    accentSecondary: '#7FF4D8',
    onAccent: '#032019',
    bg: '#04100D',
    bgCard: '#0C1A18',
    bgElevated: '#112623',
    bgGlass: 'rgba(12, 26, 24, 0.8)',
    textPrimary: '#E8FFFA',
    textSecondary: '#A5DED4',
    textMuted: '#5B887F',
    pageTop: '#0C2C24',
    pageMiddle: '#071A16',
    pageBottom: '#04100D',
    heroFrom: 'rgba(0, 191, 165, 0.18)',
    heroTo: 'rgba(127, 244, 216, 0.07)',
    tabBar: '#081714',
    glow: 'rgba(0, 191, 165, 0.18)',
  },
  atilolaRed: {
    name: 'Atilola Red',
    accent: '#E74C3C',
    accentSecondary: '#FFB199',
    onAccent: '#210806',
    bg: '#110708',
    bgCard: '#1E0D10',
    bgElevated: '#291216',
    bgGlass: 'rgba(30, 13, 16, 0.82)',
    textPrimary: '#FFF1ED',
    textSecondary: '#E2B0A5',
    textMuted: '#96655E',
    pageTop: '#341116',
    pageMiddle: '#1D0A0E',
    pageBottom: '#110708',
    heroFrom: 'rgba(231, 76, 60, 0.2)',
    heroTo: 'rgba(255, 177, 153, 0.06)',
    tabBar: '#180A0D',
    glow: 'rgba(231, 76, 60, 0.18)',
  },
} satisfies Record<string, ThemeDefinition>;

export type ThemeKey = keyof typeof ThemeDefinitions;
export const DEFAULT_THEME_KEY: ThemeKey = 'default';

const defaultTheme = ThemeDefinitions[DEFAULT_THEME_KEY];

export const Colors = {
  orange: defaultTheme.accent,
  orangeDim: darkenHex(defaultTheme.accent, 0.14),
  orangeGlow: defaultTheme.glow,
  orangeSubtle: withAlpha(defaultTheme.accent, 0.08),
  accentSecondary: defaultTheme.accentSecondary,
  onAccent: defaultTheme.onAccent,

  bg: defaultTheme.bg,
  bgCard: defaultTheme.bgCard,
  bgElevated: defaultTheme.bgElevated,
  bgGlass: defaultTheme.bgGlass,
  bgCanvasTop: defaultTheme.pageTop,
  bgCanvasMiddle: defaultTheme.pageMiddle,
  bgCanvasBottom: defaultTheme.pageBottom,
  bgHeroFrom: defaultTheme.heroFrom,
  bgHeroTo: defaultTheme.heroTo,
  bgTabBar: withAlpha(defaultTheme.tabBar, 0.72),

  surfaceSoft: withAlpha(defaultTheme.textPrimary, 0.04),
  surfaceMuted: withAlpha(defaultTheme.textPrimary, 0.07),
  surfaceStrong: withAlpha(defaultTheme.textPrimary, 0.11),
  accentSurface: withAlpha(defaultTheme.accent, 0.12),
  accentSurfaceStrong: withAlpha(defaultTheme.accent, 0.2),
  overlay: withAlpha(defaultTheme.bg, 0.78),
  overlaySoft: withAlpha(defaultTheme.bg, 0.58),

  textPrimary: defaultTheme.textPrimary,
  textSecondary: defaultTheme.textSecondary,
  textMuted: defaultTheme.textMuted,

  border: withAlpha(defaultTheme.accentSecondary, 0.12),
  borderStrong: withAlpha(defaultTheme.accentSecondary, 0.24),
  success: '#27AE60',
  error: '#E74C3C',
  white: '#FFFFFF',
  green: '#27AE60',

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
    mono: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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
  Colors.orangeGlow = theme.glow;
  Colors.orangeSubtle = withAlpha(theme.accent, 0.08);
  Colors.accentSecondary = theme.accentSecondary;
  Colors.onAccent = theme.onAccent;

  Colors.bg = theme.bg;
  Colors.bgCard = theme.bgCard;
  Colors.bgElevated = theme.bgElevated;
  Colors.bgGlass = theme.bgGlass;
  Colors.bgCanvasTop = theme.pageTop;
  Colors.bgCanvasMiddle = theme.pageMiddle;
  Colors.bgCanvasBottom = theme.pageBottom;
  Colors.bgHeroFrom = theme.heroFrom;
  Colors.bgHeroTo = theme.heroTo;
  Colors.bgTabBar = withAlpha(theme.tabBar, 0.72);

  Colors.surfaceSoft = withAlpha(theme.textPrimary, 0.04);
  Colors.surfaceMuted = withAlpha(theme.textPrimary, 0.07);
  Colors.surfaceStrong = withAlpha(theme.textPrimary, 0.11);
  Colors.accentSurface = withAlpha(theme.accent, 0.12);
  Colors.accentSurfaceStrong = withAlpha(theme.accent, 0.2);
  Colors.overlay = withAlpha(theme.bg, 0.78);
  Colors.overlaySoft = withAlpha(theme.bg, 0.58);

  Colors.textPrimary = theme.textPrimary;
  Colors.textSecondary = theme.textSecondary;
  Colors.textMuted = theme.textMuted;

  Colors.border = withAlpha(theme.accentSecondary, 0.12);
  Colors.borderStrong = withAlpha(theme.accentSecondary, 0.24);
}
