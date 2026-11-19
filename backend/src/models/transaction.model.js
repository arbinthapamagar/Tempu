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

    gatewayRef: { type: String, default: null }, // khalti pidx / esewa transaction_uuid
    // Our own order id sent to the gateway (eSewa transaction_uuid, Khalti
    // purchase_order_id) — unique per top-up attempt.
    orderRef: { type: String, default: null },
    // Raw verification response from the gateway (status API / lookup), kept
    // for reconciliation and support.
    gatewayData: { type: mongoose.Schema.Types.Mixed, default: null },
    failureReason: { type: String, default: null },
    note: { type: String, default: null },        // e.g. admin grant reason / promotion
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1 });
transactionSchema.index({ driverId: 1 });
transactionSchema.index({ tripId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ orderRef: 1 }, { unique: true, sparse: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);