import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { DB_NAME } from './src/utils/constant.js';
import { Admin } from './src/models/admin.model.js';
import { User } from './src/models/user.model.js';

const dbConnect = async () => {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log('DB connected');
};

const seed = async () => {
  await dbConnect();

  // Super Admins
  const accounts = [
    { name: 'Arbeen', email: 'arbinbabuthapamagar2002@gmail.com', phone: '9818856764', password: 'Arbeen@1', role: 'superadmin' },
  ];

  for (const acc of accounts) {
    const exists = await Admin.findOne({ $or: [{ email: acc.email }, { phone: acc.phone }] });
    if (exists) {
      console.log(`Admin ${acc.email} already exists, skipping`);
    } else {
      await Admin.create(acc);
      console.log(`Created admin: ${acc.email} / ${acc.password}`);
    }
  }

  // Mobile demo users
  const mobileUsers = [
    { name: 'Demo User', email: 'demo@gmail.com', phone: '9800000000', password: 'password' },
  ];

  for (const u of mobileUsers) {
    const exists = await User.findOne({ $or: [{ phone: u.phone }, { email: u.email }] });
    if (exists) {
      console.log(`User with phone ${u.phone} already exists, skipping`);
    } else {
      await User.create({ ...u, isPhoneVerified: true, accountStatus: 'active' });
      console.log(`Created rider: phone=${u.phone}, password=${u.password}`);
    }
  }

  console.log('\nSeed complete!');
  console.log('Admin panel:  arbinbabuthapamagar2002@gmail.com / Arbeen@1');
  console.log('Mobile login: phone=9800000000 (email=demo@gmail.com), password=password');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
