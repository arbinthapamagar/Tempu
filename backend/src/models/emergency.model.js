import mongoose from 'mongoose';

// An SOS / emergency alert raised from the mobile app by a passenger or driver.
// Surfaces live in the admin panel for staff to acknowledge and resolve.
const emergencySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    role: { type: String, enum: ['passenger', 'driver'], default: 'passenger' },

    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    address: { type: String, default: null },
    contactPhone: { type: String, default: null }, // snapshot for quick dispatch

    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    message: { type: String, default: null },

    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
    },
    // Triage priority set by the admin handling the alert.
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'very_urgent'],
      default: 'normal',
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    // Admin/agent this alert is assigned to for follow-up.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    // Internal handling notes (not shown to the person who raised the SOS).
    notes: [
      {
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
        body: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emergencySchema.index({ status: 1, createdAt: -1 });
emergencySchema.index({ userId: 1 });

export const Emergency = mongoose.model('Emergency', emergencySchema);
