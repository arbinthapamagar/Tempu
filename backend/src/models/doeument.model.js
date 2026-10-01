import mongoose from 'mongoose';
import { DOCUMENT_TYPES } from '../constants/documentTypes.js';

const documentSchema = new mongoose.Schema(
    {
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver',
            required: true,
        },

        type: {
            type: String,
            enum: DOCUMENT_TYPES,
            required: true,
        },

        fileUrl: {
            type: String,
            required: true,
        },
        // What was uploaded, so the admin can tell a PDF scan from a photo
        // without guessing from the URL.
        mimeType: { type: String, default: null },
        fileName: { type: String, default: null },

        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        rejectionReason: {
            type: String,
            default: null,
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },

        expiresAt: {
            type: Date,
            default: null,
        },
        isExpired: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

documentSchema.index({ driverId: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ type: 1 });
documentSchema.index({ expiresAt: 1 });

export const Document = mongoose.model('Document', documentSchema);
