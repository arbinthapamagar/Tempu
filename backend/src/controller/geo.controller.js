import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMapSettings, isGoogleActive } from '../models/mapSettings.model.js';

// Backend proxy for place search / geocoding. The mobile app calls these instead
// of talking to Google or OSM directly, so the Google Maps key stays server-side
// and the provider can be switched from the admin panel with no app change.
//
// Both endpoints return a NORMALISED shape regardless of provider:
//   autocomplete → { provider, predictions: [{ id, placeId, title, subtitle, coords }] }
//   place        → { provider, coords: { lat, lng }, address }
// `coords` is null for Google predictions (resolved later via /geo/place); OSM
// predictions already carry coords, so the app can skip the details round-trip.

const KTM = { lat: 27.7172, lng: 85.324 }; // bias search toward Kathmandu valley

async function fetchJson(url, headers = {}) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new apiError(502, `Map provider error (${res.status})`);
    return res.json();
}

// ---- Google Places ---------------------------------------------------------
// Pure: Google autocomplete response → normalised predictions. Exported for tests.
export function mapGooglePredictions(data) {
    return (data?.predictions || []).map((p) => ({
        id: p.place_id,
        placeId: p.place_id,
        title: p.structured_formatting?.main_text || p.description,
        subtitle: p.structured_formatting?.secondary_text || '',
        coords: null, // resolved on demand via /geo/place
    }));
}

async function googleAutocomplete(query, key, country) {
    const url =
        'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
        `?input=${encodeURIComponent(query)}` +
        `&key=${encodeURIComponent(key)}` +
        `&components=country:${encodeURIComponent(country)}` +
        `&location=${KTM.lat},${KTM.lng}&radius=30000&language=en`;
    const data = await fetchJson(url);
    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
        throw new apiError(502, `Google Places: ${data.error_message || data.status}`);
    }
    return mapGooglePredictions(data);
}

async function googlePlace(placeId, key) {
    const url =
        'https://maps.googleapis.com/maps/api/place/details/json' +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&key=${encodeURIComponent(key)}` +
        '&fields=geometry,formatted_address,name&language=en';
    const data = await fetchJson(url);
    if (data.status !== 'OK') {
        throw new apiError(502, `Google Places: ${data.error_message || data.status}`);
    }
    const loc = data.result?.geometry?.location;
    return {
        coords: loc ? { lat: loc.lat, lng: loc.lng } : null,
        address: data.result?.formatted_address || data.result?.name || '',
    };
}

// ---- OpenStreetMap / Nominatim (free fallback) -----------------------------
const NOMINATIM_HEADERS = { 'User-Agent': 'TempuApp/1.0 (ride-sharing Nepal)' };
const KTM_VIEWBOX = '85.2200,27.6200,85.5000,27.8000';

// Pure: Nominatim response → normalised predictions. Exported for tests.
export function mapOsmResults(data) {
    return (data || []).map((r) => {
        const parts = (r.display_name || '').split(',').map((s) => s.trim());
        return {
            id: String(r.place_id),
            placeId: null, // coords already present, no details lookup needed
            title: r.name || parts[0] || r.display_name,
            subtitle: parts.slice(1, 3).join(', '),
            coords: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
        };
    });
}

async function osmAutocomplete(query, country) {
    const url =
        'https://nominatim.openstreetmap.org/search' +
        `?q=${encodeURIComponent(query)}` +
        '&format=json&addressdetails=1&limit=8' +
        `&countrycodes=${encodeURIComponent(country)}` +
        `&viewbox=${KTM_VIEWBOX}&bounded=0&accept-language=en`;
    const data = await fetchJson(url, NOMINATIM_HEADERS);
    return mapOsmResults(data);
}

// Run a one-off autocomplete against AD-HOC settings (not the saved doc) so the
// admin "Test" button can verify a key before saving. Unlike the live endpoint,
// this does NOT silently fall back — a bad Google key throws so the error shows.
export async function testAutocomplete({ provider, googleMapsApiKey, countryCode, query }) {
    const q = (query || 'Thamel').trim() || 'Thamel';
    const country = (countryCode || 'np').trim().toLowerCase();
    if (provider === 'google') {
        const key = (googleMapsApiKey || '').trim();
        if (!key) throw new apiError(400, 'Enter a Google API key to test.');
        const predictions = await googleAutocomplete(q, key, country); // throws on bad key
        return { provider: 'google', query: q, predictions };
    }
    const predictions = await osmAutocomplete(q, country);
    return { provider: 'osm', query: q, predictions };
}

// GET /users/geo/autocomplete?q=...
const autocomplete = asyncHandler(async (req, res) => {
    const query = (req.query.q || '').trim();
    if (query.length < 2) {
        return res.status(200).json(new apiResponse(200, { provider: 'none', predictions: [] }, 'ok'));
    }
    const settings = await getMapSettings();
    const country = settings.countryCode || 'np';

    let predictions;
    let provider;
    if (isGoogleActive(settings)) {
        provider = 'google';
        try {
            predictions = await googleAutocomplete(query, settings.googleMapsApiKey.trim(), country);
        } catch {
            // Never leave the user with a dead search box — fall back to OSM.
            provider = 'osm';
            predictions = await osmAutocomplete(query, country);
        }
    } else {
        provider = 'osm';
        predictions = await osmAutocomplete(query, country);
    }
    return res.status(200).json(new apiResponse(200, { provider, predictions }, 'Places fetched'));
});

// GET /users/geo/place?placeId=...  (only needed for Google predictions)
const placeDetails = asyncHandler(async (req, res) => {
    const placeId = (req.query.placeId || '').trim();
    if (!placeId) throw new apiError(400, 'placeId is required');
    const settings = await getMapSettings();
    if (!isGoogleActive(settings)) {
        throw new apiError(400, 'Place details are only available with Google enabled');
    }
    const details = await googlePlace(placeId, settings.googleMapsApiKey.trim());
    return res.status(200).json(new apiResponse(200, { provider: 'google', ...details }, 'Place resolved'));
});

// ---- Directions ------------------------------------------------------------
// Decode a Google/OSRM encoded polyline (precision 5) → [{latitude, longitude}].
// Exported for tests. Both providers use the same algorithm.
export function decodePolyline(encoded) {
    if (!encoded) return [];
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

function fmtDistance(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function fmtDuration(s) {
    const min = Math.round(s / 60);
    return min < 1 ? '1 min' : `${min} min`;
}
function parseLatLng(s) {
    if (!s) return null;
    const [lat, lng] = String(s).split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

async function googleDirections(from, to, key) {
    const url =
        'https://maps.googleapis.com/maps/api/directions/json' +
        `?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}` +
        `&mode=driving&key=${encodeURIComponent(key)}`;
    const data = await fetchJson(url);
    if (data.status !== 'OK') {
        throw new apiError(502, `Google Directions: ${data.error_message || data.status}`);
    }
    const route = data.routes?.[0];
    const leg = route?.legs?.[0];
    return {
        polyline: decodePolyline(route?.overview_polyline?.points),
        distanceMeters: leg?.distance?.value ?? 0,
        durationSeconds: leg?.duration?.value ?? 0,
    };
}

async function osrmDirections(from, to) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
        '?overview=full&geometries=polyline';
    const data = await fetchJson(url);
    if (data.code !== 'Ok') throw new apiError(502, `OSRM: ${data.code || 'routing error'}`);
    const route = data.routes?.[0];
    return {
        polyline: decodePolyline(route?.geometry),
        distanceMeters: route?.distance ?? 0,
        durationSeconds: route?.duration ?? 0,
    };
}

// GET /users/geo/directions?from=lat,lng&to=lat,lng
const directions = asyncHandler(async (req, res) => {
    const from = parseLatLng(req.query.from);
    const to = parseLatLng(req.query.to);
    if (!from || !to) throw new apiError(400, 'from and to are required as "lat,lng"');

    const settings = await getMapSettings();
    let provider, r;
    if (isGoogleActive(settings)) {
        provider = 'google';
        try {
            r = await googleDirections(from, to, settings.googleMapsApiKey.trim());
        } catch {
            provider = 'osm';
            r = await osrmDirections(from, to);
        }
    } else {
        provider = 'osm';
        r = await osrmDirections(from, to);
    }
    return res.status(200).json(new apiResponse(200, {
        provider,
        polyline: r.polyline,
        distanceMeters: r.distanceMeters,
        distanceText: fmtDistance(r.distanceMeters),
        durationSeconds: r.durationSeconds,
        durationText: fmtDuration(r.durationSeconds),
    }, 'Directions fetched'));
});

export { autocomplete, placeDetails, directions };
