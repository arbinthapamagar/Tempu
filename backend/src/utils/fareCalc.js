// Server-side standard-fare calculation from the pricing config. Mirrors the
// admin simulator formula (web/frontend/src/utils/fareCalc.js) so the fare the
// rider is shown and the bid floor the server enforces stay consistent.

export function getActiveSlot(timeSlots = [], hour) {
  return timeSlots.find((s) => {
    if (s.startHour <= s.endHour) return hour >= s.startHour && hour < s.endHour;
    return hour >= s.startHour || hour < s.endHour; // wraps past midnight
  }) || null;
}

// Returns the standard fare (Rs, rounded) or null if the vehicle isn't priced.
export function computeStandardFare(config, { vehicleType, distanceKm, cityName = null, hour }) {
  const v = config?.vehicles?.[vehicleType];
  if (!v) return null;

  const dist = Number(distanceKm) || 0;
  const h = hour == null ? new Date().getHours() : hour;
  const efficiency = Number(v.efficiency) || 1;

  const elecPerKm = (Number(config.electricityCost) || 0) / efficiency;
  const baseCostPerKm = elecPerKm + (Number(v.maintenancePerKm) || 0);
  const subtotalPerKm = baseCostPerKm * (1 + (Number(config.profitMarginPercent) || 0) / 100);
  let perKm = subtotalPerKm * (1 + (Number(config.commissionPercent) || 0) / 100);

  const city = cityName ? config.cities?.find((c) => c.name === cityName) : null;
  perKm *= Number(city?.zoneMultiplier) || 1;

  let premium = 1;
  if (city?.premiumOverride) premium = Number(city.premiumMultiplier) || 1;
  else if (config.premium?.applyToAllCities) premium = Number(config.premium?.multiplier) || 1;
  perKm *= premium;

  const slot = getActiveSlot(config.timeSlots, h);
  perKm *= slot ? (Number(slot.multiplier) || 1) : 1;

  const ld = config.longDistanceDiscount || {};
  if (ld.enabled && dist > (Number(ld.thresholdKm) || 0)) {
    perKm *= 1 - (Number(ld.percent) || 0) / 100;
  }

  let baseFare = Number(v.baseFare) || 0;
  const ov = city?.vehicleOverrides?.[vehicleType];
  if (ov?.override) baseFare = Number(ov.baseFare) || 0;

  const subtotalFare = baseFare + perKm * dist;
  const vat = subtotalFare * ((Number(config.vatPercent) || 0) / 100);
  return Math.round(subtotalFare + vat);
}
