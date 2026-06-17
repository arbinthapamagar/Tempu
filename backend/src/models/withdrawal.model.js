import mongoose from 'mongoose';

// A driver cashout request. Flow: pending → approved → paid, or pending → rejected.
// The amount is deducted from the driver's walletBalance at request time and
// refunded if the request is rejected.
const withdrawalSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },

    // Where the money should be sent
    method: {
      type: String,
      enum: ['bank', 'khalti', 'esewa'],
      required: true,
    },
    destination: {
      bankName: { type: String, default: null },
      accountName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      walletId: { type: String, default: null }, // khalti/esewa id or phone
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
    },

    note: { type: String, default: null },       // optional note from the driver
    adminNote: { type: String, default: null },   // reason / reference from the admin

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    processedAt: { type: Date, default: null },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  { timestamps: true }
);

withdrawalSchema.index({ driverId: 1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });

export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
