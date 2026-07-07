import mongoose from 'mongoose';

// EV dynamic-pricing configuration (single global document, key: 'global').
// The admin panel reads/writes this whole object; the passenger fare simulator
// and analytics are computed client-side from it. See utils/fareCalc on the
// frontend for the exact formula.

// Booking vehicle types - these match the trip/driver `vehicleType` enum so the
// pricing config maps 1:1 to what riders actually book.
export const VEHICLE_TYPES = ['tuktuk', 'scooter', 'bike', 'taxi', 'comfort'];

export const PREMIUM_LABELS = [
  'Normal', 'Light Rain', 'Heavy Rain', 'Peak Hour', 'Festival', 'Strike', 'Bandh',
];

const vehicleSchema = new mongoose.Schema(
  {
    efficiency: { type: Number, default: 0 },        // km per kWh
    maintenancePerKm: { type: Number, default: 0 },  // Rs / km
    baseFare: { type: Number, default: 0 },          // Rs
    perMinuteRate: { type: Number, default: 0 },     // Rs / min (Uber-style time charge)
  },
  { _id: false }
);

const timeSlotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startHour: { type: Number, required: true }, // 0-23
    endHour: { type: Number, required: true },   // 0-23 (may wrap past midnight)
    multiplier: { type: Number, default: 1 },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    microZoneMultiplier: { type: Number, default: 1 }, // 1.0 - 1.5
  },
  { _id: false }
);

const distanceSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    km: { type: Number, default: 0 },
  },
  { _id: false }
);

const cityVehicleOverrideSchema = new mongoose.Schema(
  {
    override: { type: Boolean, default: false },
    baseFare: { type: Number, default: 0 },
  },
  { _id: false }
);

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    zoneMultiplier: { type: Number, default: 1 },        // 1.0 - 2.0
    premiumOverride: { type: Boolean, default: false },
    premiumMultiplier: { type: Number, default: 1 },     // used when override on
    vehicleOverrides: Object.fromEntries(
      VEHICLE_TYPES.map((k) => [k, { type: cityVehicleOverrideSchema, default: () => ({}) }])
    ),
    locations: { type: [locationSchema], default: [] },
    distances: { type: [distanceSchema], default: [] },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },

    // Global controls
    electricityCost: { type: Number, default: 17 },       // Rs / kWh (NEA)
    vatPercent: { type: Number, default: 13 },
    commissionPercent: { type: Number, default: 10 },     // 0-30
    profitMarginPercent: { type: Number, default: 20 },   // 0-50

    // Weather / event premium
    premium: {
      multiplier: { type: Number, default: 1 },           // 1.0 - 3.0
      label: { type: String, default: 'Normal' },
      applyToAllCities: { type: Boolean, default: true },
    },

    // Time-based pricing slots
    timeSlots: { type: [timeSlotSchema], default: [] },

    // Extra toggles
    longDistanceDiscount: {
      enabled: { type: Boolean, default: false },
      percent: { type: Number, default: 0 },
      thresholdKm: { type: Number, default: 10 },
    },

    // Per-vehicle global defaults
    vehicles: Object.fromEntries(VEHICLE_TYPES.map((k) => [k, { type: vehicleSchema, default: () => ({}) }])),

    cities: { type: [citySchema], default: [] },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

export const Pricing = mongoose.model('Pricing', pricingSchema);

// Seed defaults
const CITY_LANDMARKS = {
  Kathmandu: ['Thamel', 'Boudha', 'Koteshwor', 'Ratnapark', 'Baneshwor', 'Balaju', 'Kalanki', 'Gongabu'],
  Lalitpur: ['Pulchowk', 'Jawalakhel', 'Satdobato', 'Kumaripati', 'Lagankhel'],
  Bhaktapur: ['Durbar Square', 'Kamal Binayak', 'Suryabinayak', 'Sallaghari'],
  Pokhara: ['Lakeside', 'Mahendrapul', 'Chipledhunga', 'New Bus Park', 'Prithvi Chowk'],
  Chitwan: ['Bharatpur Airport', 'Narayanghat', 'Sauraha', 'Ratnanagar'],
  Biratnagar: ['Traffic Chowk', 'Buddha Chowk', 'Airport Road', 'Rangeli Chowk'],
  Butwal: ['Traffic Chowk', 'Butwal Bus Park', 'Kalikanagar', 'Devinagar'],
  Dharan: ['BP Chowk', 'Bhanu Chowk', 'Putali Line', 'Forest Camp'],
};

const CITY_ZONE = {
  Kathmandu: 1.4, Lalitpur: 1.3, Bhaktapur: 1.2, Pokhara: 1.2,
  Chitwan: 1.1, Biratnagar: 1.1, Butwal: 1.0, Dharan: 1.0,
};

export function defaultPricing() {
  return {
    key: 'global',
    electricityCost: 17,
    vatPercent: 13,
    commissionPercent: 10,
    profitMarginPercent: 20,
    premium: { multiplier: 1, label: 'Normal', applyToAllCities: true },
    timeSlots: [
      { name: 'Early Morning', startHour: 5, endHour: 7, multiplier: 0.9 },
      { name: 'Morning Peak', startHour: 7, endHour: 10, multiplier: 1.3 },
      { name: 'Daytime Normal', startHour: 10, endHour: 16, multiplier: 1.0 },
      { name: 'Evening Peak', startHour: 16, endHour: 20, multiplier: 1.4 },
      { name: 'Night', startHour: 20, endHour: 23, multiplier: 1.2 },
      { name: 'Late Night', startHour: 23, endHour: 5, multiplier: 1.5 },
    ],
    longDistanceDiscount: { enabled: false, percent: 10, thresholdKm: 10 },
    vehicles: {
      tuktuk: { efficiency: 12, maintenancePerKm: 2, baseFare: 30 },
      scooter: { efficiency: 35, maintenancePerKm: 1, baseFare: 20 },
      bike: { efficiency: 40, maintenancePerKm: 1, baseFare: 15 },
      taxi: { efficiency: 7, maintenancePerKm: 3, baseFare: 60 },
      comfort: { efficiency: 6, maintenancePerKm: 4, baseFare: 90 },
    },
    cities: Object.entries(CITY_LANDMARKS).map(([name, landmarks]) => ({
      name,
      zoneMultiplier: CITY_ZONE[name] ?? 1,
      premiumOverride: false,
      premiumMultiplier: 1,
      vehicleOverrides: Object.fromEntries(VEHICLE_TYPES.map((k) => [k, { override: false, baseFare: 0 }])),
      locations: landmarks.map((n) => ({ name: n, microZoneMultiplier: 1 })),
      distances: [],
    })),
  };
}
