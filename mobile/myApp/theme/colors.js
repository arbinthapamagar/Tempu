import { resolveScheme } from './themeStore';

// "Inked workshop ledger" — warm paper + ink in light; warm charcoal in dark.
// Tempu orange throughout. Text colors are tuned for contrast in each scheme.
const lightColors = {
  primary: '#ea580c',
  primaryDark: '#c2410c',
  primarySoft: '#fde7d3',

  bg: '#f4eee3',
  background: '#f4eee3',
  surface: '#fffcf7',
  surfaceMuted: '#efe7d8',
  surfaceDark: '#241f1a',

  text: '#241f1a',
  textMuted: '#7b7066',
  textFaint: '#a99e90',

  border: '#e4dccd',
  divider: '#ece3d4',

  danger: '#dc2626',
  dangerSoft: '#fbe3e0',
  warn: '#c2630e',
  warnSoft: '#fbe6d4',
  success: '#15803d',
  accent: '#ea580c',
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
};

export const themeScheme = resolveScheme(); // 'light' | 'dark', resolved at load
export const isDark = themeScheme === 'dark';
export const palettes = { light: lightColors, dark: darkColors };
export const colors = isDark ? darkColors : lightColors;
