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
export const RIDE_FEE_THRESHOLD = 80;   // NPR — the fare boundary between the two fee amounts
export const RIDE_FEE_INTRO_LIMIT = 10; // the first N rides use the intro (higher) fee

export function computeRideFee(agreedPrice, rideNumber) {
    const below = Number(agreedPrice) < RIDE_FEE_THRESHOLD;
    const introPeriodOver = Number(rideNumber) > RIDE_FEE_INTRO_LIMIT;
    if (introPeriodOver) return below ? 3 : 6;
    return below ? 5 : 10;
}
