import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema(
  {

    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    phone: { 
      type: String, 
      required: true, 
      unique: true 
    },
    email: { 
      type: String, 
      sparse: true, 
      unique: true, 
      lowercase: true, 
      trim:true, 
      default: null
    },
    password: { 
      type: String, 
      required: true 
    },
    avatarUrl: { 
      type: String, 
      default: null 
    },
    dateOfBirth: { 
      type: Date, 
      default: null 
    },
    gender: {
      type: String,
      enum: ["female", "male", "other"],
      default: null,
    },

    userType: {
      type: String,
      enum: ["regular", "parent", "business"],
      default: "regular",
    },

    isPhoneVerified: { 
      type: Boolean, 
      default: false 
    },
    isEmailVerified: { 
      type: Boolean, 
      default: false 
    },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },


    driverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },


    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },


    rating: {
      average: { type: Number, default: 5.0, min: 1, max: 5 },
      total: { type: Number, default: 0 },
    },


    walletBalance: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    preferredPaymentMethod: {
      type: String,
      enum: ["cash", "khalti", "esewa", "wallet"],
      default: "cash",
    },
    // Whether this user may send voice/document attachments in support chat.
    // Admin-controlled per user from the support section.
    supportAttachmentsAllowed: {
      type: Boolean,
      default: true,
    },


    currentLocation: {
      type: { 
        type: String, 
        enum: ["Point"], 
        default: "Point" 
      },
      coordinates: { 
        type: [Number], 
        default: [0, 0] // [lng, lat]
      },
    },


    savedAddresses: [
      {
        label: { 
          type: String, 
          enum: ["home", "work", "other"] 
        },
        address: { 
          type: String 
        },
        location: {
          type: { 
            type: String, 
            enum: ["Point"], 
            default: "Point" 
          },
          coordinates: { 
            type: [Number] 
          },
        },
      },
    ],

    fcmToken: { 
      type: String, 
      default: null 
    },
    refreshToken: { 
      type: String, 
      default: null 
    },
    lastLoginAt: { 
      type: Date, 
      default: null 
    },

    otp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },
    role:{
        type:String,
        enum:['passenger', 'driver'],
        default:'passenger'
    }
  },
  { 
    timestamps: true 
  }
);

userSchema.index({ accountStatus: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ currentLocation: "2dsphere" });
userSchema.index({ "savedAddresses.location": "2dsphere" });



// has password befor saving 


userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// compare password 

userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password,this.password)
}


// generate access token 
userSchema.methods.generateAccessToken = function () {
    return jsonwebtoken.sign(
        {
            _id: this._id,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
    return jsonwebtoken.sign(
        { _id: this._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};


export const User = mongoose.model("User", userSchema);
