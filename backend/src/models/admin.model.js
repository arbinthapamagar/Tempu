import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        avatarUrl: {
            type: String,
            default: null,
        },

        // Per-agent intro line auto-posted to a ticket when it's assigned to this
        // agent (e.g. "Hi, this is {name}, a {designation} — please hold on").
        // Supports {name} and {designation} placeholders. Empty = post nothing.
        supportGreeting: {
            type: String,
            default: '',
        },

        role: {
            type: String,
            enum: ['superadmin', 'admin', 'headmaster', 'moderator'],
            required: true,
        },

        permissions: {
            manageUsers: {
                type: Boolean,
                default: false,
            },
            manageDrivers: {
                type: Boolean,
                default: false,
            },
            manageTrips: {
                type: Boolean,
                default: false,
            },
            managePayments: {
                type: Boolean,
                default: false,
            },
            verifyDocuments: {
                type: Boolean,
                default: false,
            },
            editDocuments: {
                type: Boolean,
                default: false,
            },
            deleteDocuments: {
                type: Boolean,
                default: false,
            },
            handleSupport: {
                type: Boolean,
                default: false,
            },
            manageAdmins: {
                type: Boolean,
                default: false,
            },
            viewAnalytics: {
                type: Boolean,
                default: false,
            },
            manageSubscriptions: {
                type: Boolean,
                default: false,
            },
            manageSuppliers: {
                type: Boolean,
                default: false,
            },
            manageKnowledge: {
                type: Boolean,
                default: false,
            },
            // Agentic AI data assistant — can ask natural-language questions that
            // query live app data (users, drivers, trips, payments, etc.) via
            // whitelisted read-only tools. Off by default; superadmin auto-passes
            // (see requireAgenticAI in admin.route.js), same pattern as manageKnowledge.
            useAgenticAI: {
                type: Boolean,
                default: false,
            },
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        // only superadmin can create other admins
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },

        refreshToken: {
            type: String,
            default: null,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },

        // Persistent support rating. Accumulated as customers rate the tickets
        // this admin handled. Kept independent of the tickets themselves so the
        // score survives even after those tickets are deleted.
        //   sum     - running total of all star scores received (1-5 each)
        //   count   - number of ratings received
        //   average - sum / count, cached for quick display
        supportRating: {
            sum: { type: Number, default: 0 },
            count: { type: Number, default: 0 },
            average: { type: Number, default: 0 },
        },

        // Last time this admin viewed each badged nav section. Sidebar badges
        // count only items created after these timestamps ("new since seen").
        navSeen: {
            drivers: { type: Date, default: null },
            documents: { type: Date, default: null },
            withdrawals: { type: Date, default: null },
            support: { type: Date, default: null },
            emergencies: { type: Date, default: null },
        },
    },
    {
        timestamps: true,
    }
);

adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

adminSchema.pre('save', async function () {
    if (this.isModified('role')) {
        const ROLE_PERMISSIONS = {
            superadmin: { manageUsers: true, manageDrivers: true, manageTrips: true, managePayments: true, verifyDocuments: true, editDocuments: true, deleteDocuments: true, handleSupport: true, manageAdmins: true, viewAnalytics: true, manageSubscriptions: true, manageSuppliers: true },
            admin:      { manageUsers: true, manageDrivers: true, manageTrips: true, managePayments: true, verifyDocuments: true, editDocuments: true, deleteDocuments: true, handleSupport: true, manageAdmins: false, viewAnalytics: true, manageSubscriptions: true, manageSuppliers: true },
            headmaster: { manageUsers: true, manageDrivers: true, manageTrips: true, managePayments: false, verifyDocuments: true, editDocuments: true, deleteDocuments: false, handleSupport: true, manageAdmins: false, viewAnalytics: true, manageSubscriptions: true, manageSuppliers: true },
            moderator:  { manageUsers: true, manageDrivers: true, manageTrips: false, managePayments: false, verifyDocuments: true, editDocuments: false, deleteDocuments: false, handleSupport: true, manageAdmins: false, viewAnalytics: false, manageSubscriptions: false, manageSuppliers: false },
        };
        if (ROLE_PERMISSIONS[this.role]) this.permissions = ROLE_PERMISSIONS[this.role];
    }
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

adminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

adminSchema.methods.generateAccessToken = function () {
    return jsonwebtoken.sign(
        {
            _id: this._id,
            role: this.role,
            permissions: this.permissions,
        },
        process.env.ADMIN_ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ADMIN_ACCESS_TOKEN_EXPIRY }
    );
};

adminSchema.methods.generateRefreshToken = function () {
    return jsonwebtoken.sign({ _id: this._id }, process.env.ADMIN_REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.ADMIN_REFRESH_TOKEN_EXPIRY,
    });
};

export const Admin = mongoose.model('Admin', adminSchema);
