// API tests for the map/geo provider layer. Dependency-free — uses Node's
// built-in test runner:  npm test   (or: node --test)
//
// Covers the two things most likely to regress: the provider-selection rule
// (isGoogleActive) and the normalised response shape the mobile app depends on
// (map*Predictions). Also exercises the real autocomplete route handler for the
// short-query short-circuit, which returns without touching a provider or the DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoogleActive } from '../src/models/mapSettings.model.js';
import { mapGooglePredictions, mapOsmResults, autocomplete, testAutocomplete, decodePolyline } from '../src/controller/geo.controller.js';

test('isGoogleActive — google + real key is active', () => {
    assert.equal(isGoogleActive({ provider: 'google', googleMapsApiKey: 'AIzaSyExample' }), true);
});

test('isGoogleActive — google but blank key falls back (inactive)', () => {
    assert.equal(isGoogleActive({ provider: 'google', googleMapsApiKey: '   ' }), false);
});

test('isGoogleActive — osm provider is never "google active"', () => {
    assert.equal(isGoogleActive({ provider: 'osm', googleMapsApiKey: 'AIzaSyExample' }), false);
});

test('mapGooglePredictions — normalises and leaves coords null (resolved later)', () => {
    const data = {
        status: 'OK',
        predictions: [
            {
                place_id: 'p1',
                description: 'Thamel, Kathmandu, Nepal',
                structured_formatting: { main_text: 'Thamel', secondary_text: 'Kathmandu, Nepal' },
            },
        ],
    };
    assert.deepEqual(mapGooglePredictions(data), [
        { id: 'p1', placeId: 'p1', title: 'Thamel', subtitle: 'Kathmandu, Nepal', coords: null },
    ]);
});

test('mapGooglePredictions — tolerates an empty/zero-results payload', () => {
    assert.deepEqual(mapGooglePredictions({}), []);
    assert.deepEqual(mapGooglePredictions({ status: 'ZERO_RESULTS', predictions: [] }), []);
});

test('mapOsmResults — normalises, carries coords, placeId stays null', () => {
    const data = [
        { place_id: 123, name: 'Boudhanath Stupa', display_name: 'Boudhanath, Kathmandu, Nepal', lat: '27.7215', lon: '85.3620' },
    ];
    const [row] = mapOsmResults(data);
    assert.equal(row.id, '123');
    assert.equal(row.placeId, null);
    assert.equal(row.title, 'Boudhanath Stupa');
    assert.equal(row.subtitle, 'Kathmandu, Nepal');
    assert.deepEqual(row.coords, { lat: 27.7215, lng: 85.362 });
});

test('testAutocomplete — Google selected with no key throws a clear error (no network)', async () => {
    await assert.rejects(
        () => testAutocomplete({ provider: 'google', googleMapsApiKey: '  ', query: 'Thamel' }),
        /Enter a Google API key/,
    );
});

test('decodePolyline — decodes Google\'s canonical example to the documented points', () => {
    // From Google's Encoded Polyline Algorithm Format docs.
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    assert.equal(pts.length, 3);
    assert.deepEqual(pts[0], { latitude: 38.5, longitude: -120.2 });
    assert.deepEqual(pts[1], { latitude: 40.7, longitude: -120.95 });
    assert.deepEqual(pts[2], { latitude: 43.252, longitude: -126.453 });
});

test('decodePolyline — empty/undefined input is a no-op', () => {
    assert.deepEqual(decodePolyline(''), []);
    assert.deepEqual(decodePolyline(undefined), []);
});

test('GET /users/geo/autocomplete — short query returns empty without a provider call', async () => {
    let code, payload;
    const res = {
        status(c) { code = c; return this; },
        json(p) { payload = p; return this; },
    };
    // q length < 2 hits the guard clause and returns before getMapSettings/fetch,
    // so this needs neither a DB connection nor network access.
    await autocomplete({ query: { q: 'a' } }, res, () => {});
    assert.equal(code, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.provider, 'none');
    assert.deepEqual(payload.data.predictions, []);
});
