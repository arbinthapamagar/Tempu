// Flat per-ride platform fee charged to the driver (deducted from their prepaid
// top-up balance). NOT a percentage.
//
// Tiers depend on the AGREED price of the ride (the price the rider and driver
// settled on, i.e. trip.finalPrice) and how many rides the driver has done:
//
//   First 1-10 rides:   fare < 80 -> Rs 5    fare >= 80 -> Rs 10
//   Ride 11 onwards:    fare < 80 -> Rs 3    fare >= 80 -> Rs 6
//
// `rideNumber` is 1-based and INCLUDES the ride being charged (i.e. pass the
// driver's totalRides AFTER it has been incremented for this ride).
// Defaults used when no Pricing config is passed. These are overridden by the
// admin-editable `driverFee` block on the global Pricing document.
export const RIDE_FEE_DEFAULTS = {
    threshold: 80,
    introRides: 10,
    introBelow: 5,
    introAbove: 10,
    laterBelow: 3,
    laterAbove: 6,
};

export function computeRideFee(agreedPrice, rideNumber, cfg = {}) {
    const c = { ...RIDE_FEE_DEFAULTS, ...(cfg || {}) };
    const below = Number(agreedPrice) < Number(c.threshold);
    const introPeriodOver = Number(rideNumber) > Number(c.introRides);
    if (introPeriodOver) return below ? Number(c.laterBelow) : Number(c.laterAbove);
    return below ? Number(c.introBelow) : Number(c.introAbove);
}
