// One-off: create a test driver (User w/ role 'driver' + Driver profile).
// Idempotent — removes any existing account on the same email/phone first.
// Run:  node create-test-driver.js
import mongoose from 'mongoose';
import { User } from './src/models/user.model.js';
import { Driver } from './src/models/driver.model.js';

const URI = 'mongodb://127.0.0.1:27017/shakti';

const NAME = 'arbin';
const EMAIL = 'arbinbabu@gmail.com';
const PHONE = '9818856765';
const PASSWORD = 'Arbeen@1';

async function run() {
    await mongoose.connect(URI);
    console.log('Connected');

    // Clean up any prior account with the same email/phone.
    const existing = await User.find({ $or: [{ email: EMAIL }, { phone: PHONE }] }).select('_id').lean();
    const ids = existing.map((u) => u._id);
    if (ids.length) {
        await Driver.deleteMany({ userId: { $in: ids } });
        await User.deleteMany({ _id: { $in: ids } });
        console.log(`Removed ${ids.length} existing account(s) on that email/phone`);
    }

    // Create the user (password is hashed by the model's pre-save hook).
    const user = await User.create({
        name: NAME,
        email: EMAIL,
        phone: PHONE,
        password: PASSWORD,
        role: 'driver',
        gender: 'male',
        accountStatus: 'active',
        isPhoneVerified: true,
        isEmailVerified: true,
    });

    // Create an approved, verified driver profile with a starting fee balance.
    const driver = await Driver.create({
        userId: user._id,
        vehicleType: 'bike',
        city: 'kathmandu',
        vehiclePlate: 'BA 1 PA 1234',
        vehicleModel: 'Pulsar 150',
        vehicleColor: 'Black',
        vehicleYear: 2022,
        licenseNumber: 'LIC-ARBIN-001',
        licenseExpiry: new Date(Date.now() + 365 * 86400000),
        status: 'approved',
        isVerified: true,
        isOnline: false,
        topupBalance: 200, // prepaid balance so per-ride fee deductions can be tested
        currentLocation: { type: 'Point', coordinates: [85.324, 27.7172] },
    });

    await User.findByIdAndUpdate(user._id, { driverProfile: driver._id });

    console.log('Created test driver:');
    console.log('  name    :', NAME);
    console.log('  email   :', EMAIL);
    console.log('  phone   :', PHONE);
    console.log('  password:', PASSWORD);
    console.log('  userId  :', String(user._id));
    console.log('  driverId:', String(driver._id));
    console.log('  status  : approved / verified, topupBalance 200');

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
