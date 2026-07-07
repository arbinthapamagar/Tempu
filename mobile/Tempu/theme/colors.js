import { resolveScheme } from './themeStore';

// Simple, flat, "human-made" — neutral white/paper with near-black ink text and
// a calm ink accent (matches the redesigned admin: no bright brand orange, no
// navy-tinted greys). Semantic colours (danger/warn/success) are kept.
// UBER-STYLE LIGHT theme. Single active app theme (dark mode toggle disabled —
// see themeStore.resolveScheme). White backgrounds, near-black text, BLACK
// buttons/CTAs (white text on them), light-grey fills. Monochrome — NO orange.
const lightColors = {
  primary: '#000000',       // pure black — buttons / CTAs / active accents
  primaryDark: '#1c1b1b',   // pressed states
  primarySoft: '#eeeeee',   // surface-container — chips, active rows, icon bubbles

  bg: '#f9f9f9',            // page background (surface)
  background: '#f9f9f9',
  surface: '#ffffff',       // cards (surface-container-lowest)
  surfaceMuted: '#f3f3f4',  // inputs / muted fills (surface-container-low)
  surfaceDark: '#000000',

  text: '#1a1c1c',          // on-background near-black
  textMuted: '#5d5e60',     // secondary
  textFaint: '#747878',     // outline

  border: '#e2e2e2',        // surface-container-highest — hairline borders
  divider: '#eeeeee',

  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
  warn: '#b45309',
  warnSoft: '#fdf0e3',
  success: '#15803d',
  accent: '#000000',
  orange: '#000000',        // monochrome → black (kept token name for compatibility)
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
