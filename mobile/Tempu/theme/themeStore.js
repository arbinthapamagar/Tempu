import { Appearance } from 'react-native';

// Synchronous storage so the chosen theme is known the instant modules load —
// styles bake their colors at import. MMKV is a native module; if it isn't in
// the running binary (e.g. Expo Go, or a dev client built before it was added),
// we degrade gracefully to system theme + in-memory session override instead of
// crashing the whole app at startup.
const KEY = 'mode';
let storage = null;
try {
  // eslint-disable-next-line global-require
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV({ id: 'shakti-theme' });
} catch (e) {
  storage = null;
}

let memMode = null; // session fallback when storage is unavailable

// 'system' | 'light' | 'dark'
export function getThemeMode() {
  try {
    if (storage) return storage.getString(KEY) || 'system';
  } catch (e) { /* ignore */ }
  return memMode || 'system';
}

export function setThemeMode(mode) {
  memMode = mode;
  try {
    if (storage) storage.set(KEY, mode);
  } catch (e) { /* ignore */ }
}

// Resolve the mode down to an actual scheme.
// Dark mode is temporarily disabled (it needs a redesign), so we always resolve
// to light — even for "System" on a dark phone or a stored "dark" preference
// from before. To re-enable, restore the body below and re-add the Dark option
// in ProfileScreen's THEME_OPTIONS.
export function resolveScheme() {
  return 'light';
  // eslint-disable-next-line no-unreachable
  const mode = getThemeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export const themeStorageAvailable = !!storage;
