// Pure EV fare-calculation helpers. No React, no side effects — so the admin
// simulator, the "compare vehicles" view and analytics all share one formula.

export const VEHICLE_META = {
  tuktuk: { label: 'Rickshaw', short: 'Rickshaw' },
  scooter: { label: 'Scooter', short: 'Scooter' },
  bike: { label: 'Bike', short: 'Bike' },
  taxi: { label: 'Taxi', short: 'Taxi' },
  comfort: { label: 'Comfort', short: 'Comfort' },
}
export const VEHICLE_KEYS = ['tuktuk', 'scooter', 'bike', 'taxi', 'comfort']

const AVG_SPEED_KMH = 20
const PETROL_CO2_PER_KM = 0.12 // kg CO2 per km for an equivalent petrol vehicle

// Returns the time slot active at `hour` (0-23). Handles slots that wrap midnight.
export function getActiveSlot(timeSlots = [], hour) {
  return timeSlots.find((s) => {
    if (s.startHour <= s.endHour) return hour >= s.startHour && hour < s.endHour
    return hour >= s.startHour || hour < s.endHour // wraps past midnight
  }) || null
}

export function currentHour() {
  return new Date().getHours()
}

// Premium that actually applies to a given city.
export function effectivePremium(config, city) {
  if (city?.premiumOverride) return { value: city.premiumMultiplier || 1, source: 'city' }
  if (config?.premium?.applyToAllCities) return { value: config.premium.multiplier || 1, source: 'global' }
  return { value: 1, source: 'off' }
}

export function vehicleBaseFare(config, city, vehicleKey) {
  const ov = city?.vehicleOverrides?.[vehicleKey]
  if (ov?.override) return Number(ov.baseFare) || 0
  return Number(config?.vehicles?.[vehicleKey]?.baseFare) || 0
}

export function microZone(city, locationName) {
  const loc = city?.locations?.find((l) => l.name === locationName)
  return loc ? (Number(loc.microZoneMultiplier) || 1) : 1
}

export function lookupDistance(city, from, to) {
  if (!city?.distances) return null
  const d = city.distances.find(
    (x) => (x.from === from && x.to === to) || (x.from === to && x.to === from)
  )
  return d ? Number(d.km) : null
}

// The core calculation. Returns named numbers + a `rows` array for the breakdown
// card. Multipliers carry a `factor`, money rows carry `amount`.
export function computeFare({ config, city, vehicleKey, pickup, drop, distance, slot }) {
  const v = config?.vehicles?.[vehicleKey] || {}
  const efficiency = Number(v.efficiency) || 1
  const dist = Number(distance) || 0

  const elecPerKm = (Number(config.electricityCost) || 0) / efficiency
  const maintPerKm = Number(v.maintenancePerKm) || 0
  const baseCostPerKm = elecPerKm + maintPerKm

  const marginPct = Number(config.profitMarginPercent) || 0
  const profitPerKm = baseCostPerKm * (marginPct / 100)
  const subtotalPerKm = baseCostPerKm + profitPerKm

  const commissionPct = Number(config.commissionPercent) || 0
  const withCommission = subtotalPerKm * (1 + commissionPct / 100)

  const zone = Number(city?.zoneMultiplier) || 1
  const withZone = withCommission * zone

  const microPickup = microZone(city, pickup)
  const microDrop = microZone(city, drop)
  const microAvg = (microPickup + microDrop) / 2
  const withMicro = withZone * microAvg

  const premium = effectivePremium(config, city)
  const withPremium = withMicro * premium.value

  const slotMult = slot ? (Number(slot.multiplier) || 1) : 1
  const withTimeSlot = withPremium * slotMult

  const ld = config.longDistanceDiscount || {}
  const discountApplies = ld.enabled && dist > (Number(ld.thresholdKm) || 0)
  const discountPct = discountApplies ? (Number(ld.percent) || 0) : 0
  const finalPerKm = withTimeSlot * (1 - discountPct / 100)

  const baseFare = vehicleBaseFare(config, city, vehicleKey)
  const distanceCost = finalPerKm * dist
  const subtotalFare = baseFare + distanceCost

  const vatPct = Number(config.vatPercent) || 0
  const vat = subtotalFare * (vatPct / 100)
  const finalFare = subtotalFare + vat

  const rows = [
    { label: 'Electricity cost / km', amount: elecPerKm, hint: `Rs ${num(config.electricityCost)} ÷ ${num(efficiency)} km/kWh` },
    { label: 'Maintenance / km', amount: maintPerKm },
    { label: 'Base cost / km', amount: baseCostPerKm, strong: true },
    { label: `Profit margin (${marginPct}%)`, amount: profitPerKm, factor: 1 + marginPct / 100 },
    { label: 'Subtotal / km', amount: subtotalPerKm, strong: true },
    { label: `Commission (${commissionPct}%)`, factor: 1 + commissionPct / 100, amount: withCommission },
    { label: `Zone multiplier`, factor: zone, amount: withZone },
    { label: `Micro-zone (avg pickup & drop)`, factor: microAvg, amount: withMicro },
    { label: `Weather/event premium${premium.source === 'city' ? ' (city)' : ''}`, factor: premium.value, amount: withPremium },
    { label: `Time slot${slot ? ` · ${slot.name}` : ''}`, factor: slotMult, amount: withTimeSlot },
  ]
  if (discountApplies) {
    rows.push({ label: `Long-distance discount (${discountPct}%)`, factor: 1 - discountPct / 100, amount: finalPerKm, discount: true })
  }
  rows.push({ label: 'Final cost / km', amount: finalPerKm, strong: true })

  return {
    efficiency, elecPerKm, maintPerKm, baseCostPerKm, profitPerKm, subtotalPerKm,
    withCommission, zone, withZone, microAvg, withMicro, premium, slotMult, withTimeSlot,
    discountPct, finalPerKm, baseFare, distance: dist, distanceCost, subtotalFare,
    vatPct, vat, finalFare, rows,
  }
}

export function travelTimeMinutes(distance, speed = AVG_SPEED_KMH) {
  return (Number(distance) || 0) / speed * 60
}

export function co2SavedKg(distance) {
  return (Number(distance) || 0) * PETROL_CO2_PER_KM
}

export function chargingCost(distance, efficiency, electricityCost) {
  const eff = Number(efficiency) || 1
  return ((Number(distance) || 0) / eff) * (Number(electricityCost) || 0)
}

// Bid feedback relative to the standard fare.
export function bidFeedback(offered, standard) {
  if (!standard || !offered) return null
  const ratio = offered / standard
  if (ratio > 1.10) return { level: 'blue', label: 'Generous', driver: 'Driver likely to accept' }
  if (ratio >= 0.90) return { level: 'green', label: 'Fair', driver: 'Driver likely to accept' }
  if (ratio >= 0.75) return { level: 'amber', label: 'Borderline', driver: 'Driver may negotiate' }
  return { level: 'red', label: 'Too low', driver: 'Driver likely to reject' }
}

export function suggestedRange(standard) {
  return { low: standard * 0.85, high: standard * 1.15 }
}

export function quickBid(standard) {
  return standard * 0.90
}

function num(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function rs(n) {
  return `Rs ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
