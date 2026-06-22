import { resolveScheme } from './themeStore';

// Simple, flat, "human-made" — neutral white/paper with near-black ink text and
// a calm ink accent (matches the redesigned admin: no bright brand orange, no
// navy-tinted greys). Semantic colours (danger/warn/success) are kept.
// TRUE BLACK + ORANGE theme. This is the single active app theme (dark mode
// toggle is disabled — see themeStore.resolveScheme). Pure-black backgrounds,
// near-black lifted cards, brand orange accent. Tokens are chosen so text/icons
// that reference primary/primaryDark stay readable on dark fills.
const lightColors = {
  primary: '#fb7a3c',       // brand orange — buttons / CTAs / accents
  primaryDark: '#ea580c',   // darker orange — pressed states & strong accent text
  primarySoft: '#2a1712',   // dark orange-tinted fill (chips, active rows)

  bg: '#000000',
  background: '#000000',
  surface: '#0e0e0e',       // cards — lifted slightly off pure black
  surfaceMuted: '#161616',  // inputs / muted fills
  surfaceDark: '#000000',

  text: '#f5f5f4',          // near-white
  textMuted: '#a3a3a3',
  textFaint: '#6b6b6b',

  border: '#262626',
  divider: '#1c1c1c',

  danger: '#f87171',
  dangerSoft: '#2a1414',
  warn: '#fbbf24',
  warnSoft: '#2a2010',
  success: '#4ade80',
  accent: '#fb7a3c',
  orange: '#fb7a3c',        // brand orange — used for the user's own reply bubble
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
