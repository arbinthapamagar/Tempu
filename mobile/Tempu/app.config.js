// Dynamic Expo config. Everything static still lives in app.json; this file
// only injects the native Google Maps SDK key from the environment so the key
// isn't committed in the config.
//
// Set GOOGLE_MAPS_API_KEY in .env (Expo loads it automatically). It's read at
// build/prebuild time only and is NOT prefixed with EXPO_PUBLIC_, so it never
// gets inlined into the JS bundle. The key must have "Maps SDK for Android"
// (and "Maps SDK for iOS" for iOS builds) enabled in Google Cloud Console.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export default ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: GOOGLE_MAPS_API_KEY },
    },
  },
});
