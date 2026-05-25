import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Admin } from '../src/models/admin.model.js';
import { DB_NAME } from '../src/utils/constant.js';

const superadmin = {
    name: 'Super Admin',
    email: 'admin@shakti.app',
    phone: '9800000000',
    password: 'Shakti@Admin1',
    role: 'superadmin',
};

async function seed() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log('Connected to MongoDB');

    const existing = await Admin.findOne({ email: superadmin.email });
    if (existing) {
        console.log('Superadmin already exists:', existing.email);
        await mongoose.disconnect();
        return;
    }

    const admin = await Admin.create(superadmin);
    console.log('Superadmin created:', admin.email);
    console.log('Password:', superadmin.password);
    await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
