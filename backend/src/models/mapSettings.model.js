import mongoose from 'mongoose';

// Global map/geo configuration — a single document (key:'global') that controls
// which provider powers place search, geocoding and directions across the app.
//
//  - provider 'google' → the backend geo proxy calls Google Maps Platform using
//    `googleMapsApiKey`. Best coverage for Nepal, billed per request.
//  - provider 'osm'    → the proxy falls back to free OpenStreetMap/Nominatim
//    (no key needed). Also used automatically whenever provider is 'google' but
//    no key has been entered yet, so the app never breaks.
//
// The key lives here (server-side) rather than in the app so it can be rotated
// from the admin panel without an app rebuild, and never ships to clients.
const mapSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    provider: { type: String, enum: ['google', 'osm'], default: 'osm' },
    googleMapsApiKey: { type: String, default: '' },
    // Restrict search/geocoding results to this country (ISO 3166-1 alpha-2).
    countryCode: { type: String, default: 'np' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

export const MapSettings = mongoose.model('MapSettings', mapSettingsSchema);

// Get-or-create the singleton.
export async function getMapSettings() {
  let doc = await MapSettings.findOne({ key: 'global' });
  if (!doc) doc = await MapSettings.create({ key: 'global' });
  return doc;
}

// True only when Google is selected AND a key is actually present. Everything
// else (osm, or google-without-key) means "use the free fallback".
export function isGoogleActive(doc) {
  return doc?.provider === 'google' && !!(doc.googleMapsApiKey || '').trim();
}
