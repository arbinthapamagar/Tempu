import { DevSettings } from 'react-native';

// Theme is baked into StyleSheets at module load, so switching it reloads the
// JS bundle. Prefer expo-updates (works in production) and fall back to
// DevSettings (development client).
export function reloadApp() {
  try {
    // eslint-disable-next-line global-require
    const Updates = require('expo-updates');
    if (Updates?.reloadAsync) {
      // Rejects when updates are disabled (dev builds) — fall back then.
      Updates.reloadAsync().catch(() => DevSettings.reload());
      return;
    }
  } catch { /* expo-updates not installed */ }
  DevSettings.reload();
}
