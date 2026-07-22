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
