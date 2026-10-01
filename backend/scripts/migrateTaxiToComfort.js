/**
 * One-off: the 'taxi' vehicle type was removed. Moves every stored record that
 * still says 'taxi' to 'comfort' (the remaining car class) so those documents
 * pass the narrowed enums the next time they are saved, and drops the now-dead
 * taxi keys from the pricing config.
 *
 *   node scripts/migrateTaxiToComfort.js            # apply
 *   DRY_RUN=1 node scripts/migrateTaxiToComfort.js  # only count
 *
 * Raw collection updates on purpose: going through the models would run the
 * very enum validation this script exists to satisfy. Safe to re-run.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { DB_NAME } from '../src/utils/constant.js';

const DRY = !!process.env.DRY_RUN;

async function run() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    const db = mongoose.connection.db;

    for (const name of ['drivers', 'trips', 'subscriptions']) {
        const col = db.collection(name);
        const filter = { vehicleType: 'taxi' };
        const n = await col.countDocuments(filter);
        if (!DRY && n) await col.updateMany(filter, { $set: { vehicleType: 'comfort' } });
        console.log(`${name}: ${n} taxi → comfort${DRY ? ' (dry run)' : ''}`);
    }

    const pricing = db.collection('pricings');
    const p = await pricing.countDocuments({ 'vehicles.taxi': { $exists: true } });
    if (!DRY && p) {
        await pricing.updateMany({}, { $unset: { 'vehicles.taxi': '', 'cities.$[].vehicleOverrides.taxi': '' } });
    }
    console.log(`pricings: ${p} with taxi keys removed${DRY ? ' (dry run)' : ''}`);

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
