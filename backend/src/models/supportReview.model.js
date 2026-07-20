import mongoose from 'mongoose';

// A customer's rating/review of a support agent, stored INDEPENDENTLY of the
// support ticket. This survives even if the ticket is later deleted — so an
// agent's rating history and feedback are never lost. Written when a ticket is
// rated (upserted by ticketId so re-rating updates the same review).
const supportReviewSchema = new mongoose.Schema(
    {
        agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
        // Kept as a loose reference (no populate) — the ticket may be deleted later.
        ticketId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
        subject: { type: String, default: '' },
        score: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, default: '' },
        tags: { type: [String], default: [] },
        customer: { type: String, default: 'Customer' }, // snapshot name
        ratedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const SupportReview = mongoose.model('SupportReview', supportReviewSchema);
