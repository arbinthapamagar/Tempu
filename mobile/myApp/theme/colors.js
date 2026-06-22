import { resolveScheme } from './themeStore';

// Simple, flat, "human-made" — neutral white/paper with near-black ink text and
// a calm ink accent (matches the redesigned admin: no bright brand orange, no
// navy-tinted greys). Semantic colours (danger/warn/success) are kept.
const lightColors = {
  primary: '#1f242b',       // ink — buttons / CTAs
  primaryDark: '#0b0d11',
  primarySoft: '#f0f0f1',   // light neutral fill (chips, active rows)

  bg: '#f4f4f5',
  background: '#f4f4f5',
  surface: '#ffffff',
  surfaceMuted: '#f0f0f1',
  surfaceDark: '#18181b',

  text: '#0b0d11',          // near-black
  textMuted: '#5b5f66',
  textFaint: '#9b9ba1',

  border: '#e7e7e9',
  divider: '#efeff0',

  danger: '#dc2626',
  dangerSoft: '#fdeaea',
  warn: '#b45309',
  warnSoft: '#f6ecdf',
  success: '#15803d',
  accent: '#1f242b',
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
