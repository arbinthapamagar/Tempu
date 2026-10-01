// Web-only wrapper around expo-location, wired up in metro.config.js. Everything
// is the real module except:
//   - geocoding: expo-location dropped web geocoding in SDK 49, so in a browser
//     the map pickers could only ever say "Selected location". These use
//     OpenStreetMap's Nominatim (no key; fine for dev traffic — its policy is
//     ~1 request/second, and callers already debounce).
//   - watchPositionAsync / watchHeadingAsync: the package's web subscriber calls
//     LocationEventEmitter.removeSubscription, which this expo-modules-core no
//     longer has, so stopping a watch (leaving the Home map) crashed the whole
//     app. These go straight to navigator.geolocation instead.
export * from 'expo-location/build/index';

function toLocationObject(p) {
  const c = p.coords;
  return {
    coords: {
      latitude: c.latitude,
      longitude: c.longitude,
      altitude: c.altitude,
      accuracy: c.accuracy,
      altitudeAccuracy: c.altitudeAccuracy,
      heading: c.heading,
      speed: c.speed,
    },
    timestamp: p.timestamp,
  };
}

export async function watchPositionAsync(options = {}, callback, errorHandler) {
  if (!navigator.geolocation) throw new Error('Geolocation is not available in this browser');
  const id = navigator.geolocation.watchPosition(
    (p) => callback(toLocationObject(p)),
    (err) => errorHandler?.(err?.message || 'Location unavailable'),
    {
      enableHighAccuracy: (options.accuracy ?? 3) >= 4,
      maximumAge: options.timeInterval ?? 0,
    }
  );
  return { remove: () => navigator.geolocation.clearWatch(id) };
}

// Browsers expose no compass heading; resolve with a no-op subscription.
export async function watchHeadingAsync() {
  return { remove() {} };
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

export async function reverseGeocodeAsync({ latitude, longitude }) {
  const res = await fetch(
    `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return [];
  const d = await res.json();
  const a = d.address || {};
  // Same shape as expo-location's LocationGeocodedAddress.
  return [{
    name: d.name || a.amenity || a.building || null,
    street: a.road || a.pedestrian || null,
    streetNumber: a.house_number || null,
    district: a.suburb || a.neighbourhood || a.quarter || null,
    city: a.city || a.town || a.village || a.municipality || null,
    subregion: a.county || a.state_district || null,
    region: a.state || null,
    postalCode: a.postcode || null,
    country: a.country || null,
    isoCountryCode: a.country_code ? a.country_code.toUpperCase() : null,
    formattedAddress: d.display_name || null,
    timezone: null,
  }];
}

export async function geocodeAsync(address) {
  const res = await fetch(
    `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=np&q=${encodeURIComponent(address)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return [];
  const list = await res.json();
  return list.map((r) => ({ latitude: Number(r.lat), longitude: Number(r.lon), altitude: null, accuracy: null }));
}
