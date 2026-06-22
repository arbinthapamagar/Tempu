import { resolveScheme } from './themeStore';

// Simple, flat, "human-made" — neutral white/paper with near-black ink text and
// a calm ink accent (matches the redesigned admin: no bright brand orange, no
// navy-tinted greys). Semantic colours (danger/warn/success) are kept.
// UBER-STYLE LIGHT theme. Single active app theme (dark mode toggle disabled —
// see themeStore.resolveScheme). White backgrounds, near-black text, BLACK
// buttons/CTAs (white text on them), light-grey fills. Monochrome — NO orange.
const lightColors = {
  primary: '#0a0a0a',       // black — buttons / CTAs / active accents
  primaryDark: '#000000',   // pure black — pressed states
  primarySoft: '#f2f2f3',   // light grey fill (chips, active rows, icon bubbles)

  bg: '#ffffff',
  background: '#ffffff',
  surface: '#ffffff',       // cards
  surfaceMuted: '#f4f4f5',  // inputs / muted fills
  surfaceDark: '#0a0a0a',

  text: '#0a0a0a',          // near-black
  textMuted: '#6b7280',
  textFaint: '#9ca3af',

  border: '#e5e5e7',
  divider: '#eeeeef',

  danger: '#dc2626',
  dangerSoft: '#fde8e8',
  warn: '#b45309',
  warnSoft: '#fdf0e3',
  success: '#15803d',
  accent: '#0a0a0a',
  orange: '#0a0a0a',        // de-oranged → black (kept token name for compatibility)
};

const darkColors = {
  primary: '#fb7a3c',
  primaryDark: '#ea580c',
  primarySoft: '#3a2618',

  bg: '#1a1714',
  background: '#1a1714',
  surface: '#241f1a',
  surfaceMuted: '#2e2823',
  surfaceDark: '#0f0d0b',

  text: '#f3ece1',
  textMuted: '#b3a899',
  textFaint: '#8a8073',

  border: '#3a342d',
  divider: '#2e2823',

  danger: '#f87171',
  dangerSoft: '#3a1f1f',
  warn: '#fbbf24',
  warnSoft: '#39290f',
  success: '#4ade80',
  accent: '#fb7a3c',
  orange: '#fb7a3c',        // brand orange — used for the user's own reply bubble
};

export const themeScheme = resolveScheme(); // 'light' | 'dark', resolved at load
export const isDark = themeScheme === 'dark';
export const palettes = { light: lightColors, dark: darkColors };
export const colors = isDark ? darkColors : lightColors;
