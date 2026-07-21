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
    return (data.predictions || []).map((p) => ({
        id: p.place_id,
        placeId: p.place_id,
        title: p.structured_formatting?.main_text || p.description,
        subtitle: p.structured_formatting?.secondary_text || '',
        coords: null, // resolved on demand via /geo/place
    }));
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

async function osmAutocomplete(query, country) {
    const url =
        'https://nominatim.openstreetmap.org/search' +
        `?q=${encodeURIComponent(query)}` +
        '&format=json&addressdetails=1&limit=8' +
        `&countrycodes=${encodeURIComponent(country)}` +
        `&viewbox=${KTM_VIEWBOX}&bounded=0&accept-language=en`;
    const data = await fetchJson(url, NOMINATIM_HEADERS);
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

export { autocomplete, placeDetails };
