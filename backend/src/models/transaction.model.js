import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },

    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: [
        'trip_payment',       // rider pays for trip
        'trip_earning',       // driver earns from trip
        'subscription_payment',// subscription fee
        'wallet_topup',       // add money to wallet
        'wallet_withdrawal',  // driver withdraws / cashes out
        'admin_credit',       // admin grants money to a driver
        'platform_fee',       // your 4-5% cut
        'refund',             // refund to rider
      ],
      required: true,
    },
    method: {
      type: String,
      enum: ['cash', 'khalti', 'esewa', 'wallet'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },

    gatewayRef: { type: String, default: null }, // khalti/esewa transaction id
    note: { type: String, default: null },        // e.g. admin grant reason / promotion
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1 });
transactionSchema.index({ driverId: 1 });
transactionSchema.index({ tripId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);