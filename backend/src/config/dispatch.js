// Time-tiered ride dispatch.
//
// A pending trip is offered to progressively wider rings of nearby drivers.
// The visible radius grows with the trip's age (one tier per minute), so the
// closest drivers get first shot; if none accept/bid within a minute the ring
// widens, and after the last tier the trip is treated as "no driver found".
//
// Radii are per REQUEST vehicle type (metres). Timing (1 min per tier) is the
// same for every type — only the distances differ.
export const DISPATCH_TIERS = {
    scooter: [100, 500, 1000],
    bike: [100, 500, 1000], // scooter-class
    tuktuk: [200, 900, 1500], // Tempu
    taxi: [200, 900, 1500], // car
    comfort: [200, 900, 1500], // car
    tuktuk_delivery: [200, 900, 2000], // delivery
};

const DEFAULT_TIERS = [200, 900, 1500];

// How long each tier stays active before widening to the next.
export const TIER_WINDOW_MS = 60 * 1000; // 1 minute

export function tiersFor(vehicleType) {
    return DISPATCH_TIERS[vehicleType] || DEFAULT_TIERS;
}

// The largest ring for a type — used to bound the candidate geo-query.
export function maxDispatchRadius(vehicleType) {
    const t = tiersFor(vehicleType);
    return t[t.length - 1];
}

// Total time a trip is dispatchable before "no driver found".
export function totalDispatchWindowMs(vehicleType) {
    return tiersFor(vehicleType).length * TIER_WINDOW_MS;
}

// The radius (metres) a trip is currently visible within, given its age.
// Returns null once the trip has aged past its final tier (→ expired).
export function currentDispatchRadius(vehicleType, createdAt, now = Date.now()) {
    const tiers = tiersFor(vehicleType);
    const ageMs = now - new Date(createdAt).getTime();
    const idx = Math.floor(ageMs / TIER_WINDOW_MS);
    if (idx < 0) return tiers[0];
    if (idx >= tiers.length) return null; // past last tier → no more offers
    return tiers[idx];
}

export function isDispatchExpired(vehicleType, createdAt, now = Date.now()) {
    return currentDispatchRadius(vehicleType, createdAt, now) === null;
}

// ---------------------------------------------------------------------------
// Vehicle compatibility — the single source of truth (was duplicated across
// trip / driver / bid controllers). Symmetric: used both to pick which driver
// types a trip is offered to, and which trip types a driver may serve.
export const VEHICLE_COMPATIBILITY = {
    scooter: ['scooter', 'bike'],
    bike: ['bike', 'scooter'],
    tuktuk: ['tuktuk', 'tuktuk_delivery'],
    tuktuk_delivery: ['tuktuk_delivery', 'tuktuk'],
    taxi: ['taxi'],
    comfort: ['comfort'],
};

export function compatibleTypes(vehicleType) {
    return VEHICLE_COMPATIBILITY[vehicleType] || [vehicleType];
}

// Great-circle distance in metres between two [lng, lat] points.
// Uses the SAME Earth radius MongoDB's 2dsphere $geoNear uses (6 378 100 m,
// equatorial) — not the mean 6 371 000 m — so this write-side ring check agrees
// to the metre with the read-side distances returned by getNearbyTrips. Without
// this, a driver on a ring boundary could be shown a request yet blocked from
// bidding on it (a ~0.11% / ~1.6 m-at-1.5 km disagreement).
export function metresBetween([lng1, lat1], [lng2, lat2]) {
    const R = 6378100;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Is a driver at `driverCoords` currently allowed to see/bid on a trip, given
// the trip's age-based ring? False if expired or outside the current ring.
export function isWithinCurrentRing(vehicleType, createdAt, driverCoords, pickupCoords, now = Date.now()) {
    if (!Array.isArray(driverCoords) || driverCoords.length !== 2) return false;
    const radius = currentDispatchRadius(vehicleType, createdAt, now);
    if (radius === null) return false;
    return metresBetween(driverCoords, pickupCoords) <= radius;
}
