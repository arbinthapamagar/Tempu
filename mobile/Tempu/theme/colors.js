import { resolveScheme } from './themeStore';

// BRAND-GREEN LIGHT theme. Single active app theme (dark mode toggle disabled -
// see themeStore.resolveScheme). White backgrounds, near-black text, GREEN
// buttons/CTAs (white text on them) matching the Tempu logo (#2dbc64), light
// green-tinted fills. Semantic colours (danger/warn/success) are kept.
const lightColors = {
  primary: '#2dbc64',       // Tempu logo green - buttons / CTAs / active accents
  primaryDark: '#23a355',   // pressed states
  primarySoft: '#e3f6ea',   // surface-container - chips, active rows, icon bubbles

  bg: '#f9faf9',            // page background (surface), faint green-neutral
  background: '#f9faf9',
  surface: '#ffffff',       // cards (surface-container-lowest)
  surfaceMuted: '#f1f5f2',  // inputs / muted fills (surface-container-low)
  surfaceDark: '#0e1a12',

  text: '#141c17',          // on-background near-black
  textMuted: '#5b625d',     // secondary
  textFaint: '#79817b',     // outline

  border: '#e2e7e3',        // surface-container-highest - hairline borders
  divider: '#eef1ef',

  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
  warn: '#b45309',
  warnSoft: '#fdf0e3',
  success: '#15803d',
  accent: '#2dbc64',
  orange: '#2dbc64',        // brand green (kept token name for compatibility)
};

const darkColors = {
  primary: '#34d17a',
  primaryDark: '#26b567',
  primarySoft: '#123320',

  bg: '#0f1512',
  background: '#0f1512',
  surface: '#161d19',
  surfaceMuted: '#1e2722',
  surfaceDark: '#080b09',

  text: '#e9f1ec',
  textMuted: '#a3b0a8',
  textFaint: '#7c877f',

  border: '#2a332d',
  divider: '#1e2722',

  danger: '#f87171',
  dangerSoft: '#3a1f1f',
  warn: '#fbbf24',
  warnSoft: '#39290f',
  success: '#4ade80',
  accent: '#34d17a',
  orange: '#34d17a',        // brand green - used for the user's own reply bubble
};

export const themeScheme = resolveScheme(); // 'light' | 'dark', resolved at load
export const isDark = themeScheme === 'dark';
export const palettes = { light: lightColors, dark: darkColors };
export const colors = isDark ? darkColors : lightColors;
