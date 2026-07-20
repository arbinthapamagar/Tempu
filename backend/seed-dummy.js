// One-off dummy-data seeder for the Shakti admin dashboard.
// Creates ~10 of each entity with valid relationships so every list is populated.
// Run:  node seed-dummy.js
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, 'public', 'docs');
const DOCS_BASE_URL = 'http://localhost:8001/docs';

// Build a minimal but valid one-page PDF (Helvetica) with a title and text
// lines. Byte offsets in the xref are computed exactly so browsers/pdf.js open
// it. No external library needed.
function makePdf(title, lines) {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    let stream = `BT\n/F1 20 Tf\n60 780 Td\n(${esc(title)}) Tj\n/F1 12 Tf\n`;
    lines.forEach((ln, i) => { stream += `0 -${i === 0 ? 34 : 20} Td\n(${esc(ln)}) Tj\n`; });
    stream += 'ET';
    const len = Buffer.byteLength(stream, 'latin1');

    const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${len} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((body, i) => { offsets[i] = Buffer.byteLength(pdf, 'latin1'); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf, 'latin1');
    const size = objs.length + 1;
    pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
    offsets.forEach((off) => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
}

import { User } from './src/models/user.model.js';
import { Driver } from './src/models/driver.model.js';
import { Trip } from './src/models/trip.model.js';
import { Transaction } from './src/models/transaction.model.js';
import { Subscription } from './src/models/subscription.model.js';
import { Supplier } from './src/models/supplier.model.js';
import { Withdrawal } from './src/models/withdrawal.model.js';
import { Emergency } from './src/models/emergency.model.js';
import { SupportTicket } from './src/models/supportTicket.model.js';
import { Document } from './src/models/doeument.model.js';
import { Review } from './src/models/review.model.js';
import { SupportReview } from './src/models/supportReview.model.js';
import { Admin } from './src/models/admin.model.js';
import { Notification } from './src/models/notification.model.js';

const URI = 'mongodb://127.0.0.1:27017/shakti';
const N = 30;

const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);
const KTM = [85.324, 27.7172];
const near = (i) => [85.30 + i * 0.004, 27.70 + i * 0.004];

const FIRST = ['Aarav', 'Sita', 'Bibek', 'Puja', 'Ramesh', 'Anita', 'Kiran', 'Sunita', 'Nabin', 'Gita', 'Hari', 'Maya'];
const LAST = ['Shrestha', 'Gurung', 'Thapa', 'Karki', 'Tamang', 'Rai', 'Magar', 'Adhikari', 'Bhandari', 'Poudel'];
const VEHICLES = ['bike', 'scooter', 'tuktuk', 'taxi', 'comfort'];
const CITIES = ['kathmandu', 'pokhara', 'lalitpur', 'bhaktapur', 'birgunj', 'butwal', 'other'];
const name = (i) => `${pick(FIRST, i)} ${pick(LAST, i * 3 + 1)}`;

async function run() {
    await mongoose.connect(URI);
    console.log('Connected to', URI);

    // ---- Clean up any previous run of this seeder (idempotent) ----
    const prevUsers = await User.find({ email: /@demo\.test$/ }).select('_id').lean();
    const prevUserIds = prevUsers.map((u) => u._id);
    const prevDrivers = await Driver.find({ userId: { $in: prevUserIds } }).select('_id').lean();
    const prevDriverIds = prevDrivers.map((d) => d._id);
    if (prevUserIds.length) {
        await Promise.all([
            Trip.deleteMany({ userId: { $in: prevUserIds } }),
            Transaction.deleteMany({ $or: [{ userId: { $in: prevUserIds } }, { driverId: { $in: prevDriverIds } }] }),
            Subscription.deleteMany({ userId: { $in: prevUserIds } }),
            Withdrawal.deleteMany({ driverId: { $in: prevDriverIds } }),
            Emergency.deleteMany({ userId: { $in: prevUserIds } }),
            Document.deleteMany({ driverId: { $in: prevDriverIds } }),
            Review.deleteMany({ fromUser: { $in: prevUserIds } }),
            SupportTicket.deleteMany({ userId: { $in: prevUserIds } }),
            Notification.deleteMany({ $or: [{ userId: { $in: prevUserIds } }, { driverId: { $in: prevDriverIds } }] }),
        ]);
        await Driver.deleteMany({ _id: { $in: prevDriverIds } });
        await User.deleteMany({ _id: { $in: prevUserIds } });
    }
    await Supplier.deleteMany({ email: /@demo\.test$/ });
    await Admin.deleteMany({ email: /@demo\.test$/ }); // only demo admins, never real ones
    console.log(`Cleaned up ${prevUserIds.length} previous demo users and their related records`);

    // ---- Extra admin users (Admin Users list) — created early so support
    // tickets can be distributed across the support-agent pool below. ----
    let adminCount = 0;
    for (let i = 0; i < 6; i++) {
        await Admin.create({
            name: `${name(i + 7)} (Staff)`,
            email: `staff${i + 1}@demo.test`,
            phone: `9850${String(400000 + i).slice(-6)}`,
            password: 'Password123',
            role: pick(['moderator', 'headmaster'], i), // pre-save hook assigns role permissions
            isActive: i % 5 !== 0,
        });
        adminCount++;
    }
    console.log(`Created ${adminCount} demo admins`);

    // Support-agent pool = the same set the app auto-assigns to: ACTIVE
    // moderators with handleSupport. Tickets round-robin across these, never
    // the superadmin (who only picks up tickets manually).
    const agents = await Admin.find({ isActive: { $ne: false }, role: 'moderator', 'permissions.handleSupport': true })
        .select('_id name').sort({ _id: 1 }).lean();
    if (!agents.length) throw new Error('No moderator support agents found to assign tickets to.');
    console.log(`Support agent pool (${agents.length}): ${agents.map((a) => a.name).join(', ')}`);

    // ---- Passengers ----
    const passengers = [];
    for (let i = 0; i < N; i++) {
        const u = await User.create({
            name: name(i),
            phone: `9810${String(100000 + i).slice(-6)}`,
            email: `rider${i + 1}@demo.test`,
            password: 'Password123',
            gender: pick(['male', 'female', 'other'], i),
            userType: pick(['regular', 'regular', 'parent', 'business'], i),
            accountStatus: pick(['active', 'active', 'active', 'suspended', 'banned'], i),
            isPhoneVerified: i % 2 === 0,
            isEmailVerified: i % 3 === 0,
            walletBalance: (i * 137) % 2000,
            rating: { average: 3.5 + (i % 3) * 0.5, total: i * 2 },
            preferredPaymentMethod: pick(['cash', 'khalti', 'esewa', 'wallet'], i),
            savedAddresses: [{ label: 'home', address: `Ward ${i + 1}, Kathmandu`, location: { type: 'Point', coordinates: near(i) } }],
        });
        passengers.push(u);
    }
    console.log(`Created ${passengers.length} passengers`);

    // ---- Drivers (each backed by its own user) ----
    const drivers = [];
    for (let i = 0; i < N; i++) {
        const du = await User.create({
            name: name(i + 5),
            phone: `9820${String(200000 + i).slice(-6)}`,
            email: `driver${i + 1}@demo.test`,
            password: 'Password123',
            gender: pick(['male', 'female', 'other'], i + 1),
            role: 'driver',
            accountStatus: 'active',
            isPhoneVerified: true,
            rating: { average: 4 + (i % 2) * 0.5, total: i * 3 },
        });
        const status = pick(['pending', 'approved', 'approved', 'suspended', 'rejected'], i);
        const d = await Driver.create({
            userId: du._id,
            vehicleType: pick(VEHICLES, i),
            city: pick(CITIES, i),
            vehiclePlate: `BA ${10 + i} PA ${1000 + i}`,
            vehicleModel: pick(['Pulsar 150', 'Activa 6G', 'Bajaj RE', 'Suzuki Access', 'Hyundai i10'], i),
            vehicleColor: pick(['Black', 'Red', 'White', 'Blue', 'Silver'], i),
            vehicleYear: 2018 + (i % 6),
            licenseNumber: `LIC-${20240000 + i}`,
            licenseExpiry: daysAhead(200 + i * 10),
            status,
            isVerified: status === 'approved',
            isOnline: i % 2 === 0,
            rating: 4 + (i % 2) * 0.5,
            totalRatings: i * 3,
            totalRides: i * 12,
            earnings: i * 1500,
            walletBalance: i * 300,
            topupBalance: pick([100, 250, 500, 40, 0], i), // starting prepaid fee balance (some low, to test)
            currentLocation: { type: 'Point', coordinates: near(i) },
        });
        await User.findByIdAndUpdate(du._id, { driverProfile: d._id });
        drivers.push(d);
    }
    console.log(`Created ${drivers.length} drivers`);

    // ---- Trips ----
    const trips = [];
    for (let i = 0; i < N; i++) {
        const t = await Trip.create({
            userId: pick(passengers, i)._id,
            driverId: pick(drivers, i)._id,
            vehicleType: pick(VEHICLES, i),
            pickup: { address: `Pickup ${i + 1}, Kathmandu`, location: { type: 'Point', coordinates: near(i) } },
            dropoff: { address: `Dropoff ${i + 1}, Lalitpur`, location: { type: 'Point', coordinates: near(i + 3) } },
            offeredPrice: 150 + i * 25,
            finalPrice: 150 + i * 25,
            distance: 2 + i,
            duration: 10 + i * 2,
            status: pick(['completed', 'completed', 'cancelled', 'started', 'pending'], i),
            paymentMethod: pick(['cash', 'khalti', 'esewa', 'wallet'], i),
            paymentStatus: pick(['paid', 'paid', 'pending', 'refunded'], i),
            platformFee: Math.round((150 + i * 25) * 0.05),
            completedAt: daysAgo(i),
        });
        trips.push(t);
    }
    console.log(`Created ${trips.length} trips`);

    // ---- Transactions ----
    for (let i = 0; i < N; i++) {
        await Transaction.create({
            userId: pick(passengers, i)._id,
            driverId: i % 2 === 0 ? pick(drivers, i)._id : null,
            tripId: pick(trips, i)._id,
            amount: 100 + i * 40,
            type: pick(['trip_payment', 'trip_earning', 'wallet_topup', 'platform_fee', 'refund', 'admin_credit'], i),
            method: pick(['cash', 'khalti', 'esewa', 'wallet'], i),
            status: pick(['completed', 'completed', 'pending', 'failed', 'refunded'], i),
            note: 'Seeded demo transaction',
        });
    }
    console.log(`Created ${N} transactions`);

    // ---- Subscriptions ----
    for (let i = 0; i < N; i++) {
        const isParent = i % 2 === 0;
        await Subscription.create({
            userId: pick(passengers, i)._id,
            plan: isParent ? 'parent' : 'business',
            childName: isParent ? name(i + 2) : undefined,
            childAge: isParent ? 6 + (i % 10) : undefined,
            schoolName: isParent ? `School No. ${i + 1}` : undefined,
            businessName: !isParent ? `Trade Co. ${i + 1}` : undefined,
            businessAddress: !isParent ? `Industrial Area ${i + 1}` : undefined,
            goodsType: !isParent ? 'General goods' : undefined,
            pickup: { address: `Home ${i + 1}`, location: { type: 'Point', coordinates: near(i) } },
            dropoff: { address: `Destination ${i + 1}`, location: { type: 'Point', coordinates: near(i + 2) } },
            pickupTime: '08:00',
            dropoffTime: '15:30',
            primaryDriver: pick(drivers, i)._id,
            monthlyPrice: 6000 + i * 500,
            status: pick(['active', 'active', 'paused', 'cancelled', 'expired'], i),
            startDate: daysAgo(30),
            endDate: daysAhead(30 + i),
            vehicleType: pick(VEHICLES, i),
        });
    }
    console.log(`Created ${N} subscriptions`);

    // ---- Suppliers ----
    for (let i = 0; i < N; i++) {
        await Supplier.create({
            businessName: `${pick(LAST, i)} Motors`,
            contactPerson: name(i),
            phone: `9840${String(300000 + i).slice(-6)}`,
            email: `supplier${i + 1}@demo.test`,
            address: `Auto Market ${i + 1}`,
            city: pick(CITIES, i),
            isVerified: i % 2 === 0,
            plan: pick(['basic', 'premium'], i),
            planExpiresAt: daysAhead(60 + i * 5),
            vehicles: [{ type: pick(['tuktuk', 'scooter'], i), brand: 'Bajaj', model: `Model ${i}`, offerType: pick(['sale', 'rent', 'installment'], i), price: 250000 + i * 10000, available: true }],
            isActive: true,
        });
    }
    console.log(`Created ${N} suppliers`);

    // ---- Withdrawals ----
    for (let i = 0; i < N; i++) {
        await Withdrawal.create({
            driverId: pick(drivers, i)._id,
            amount: 1000 + i * 250,
            method: pick(['bank', 'khalti', 'esewa'], i),
            destination: { bankName: 'Nabil Bank', accountName: name(i), accountNumber: `01234${i}5678`, walletId: `98${i}0000000` },
            status: pick(['pending', 'approved', 'paid', 'rejected'], i),
            note: 'Seeded demo withdrawal',
        });
    }
    console.log(`Created ${N} withdrawals`);

    // ---- Emergencies ----
    for (let i = 0; i < N; i++) {
        await Emergency.create({
            userId: pick(passengers, i)._id,
            driverId: i % 2 === 0 ? pick(drivers, i)._id : null,
            role: i % 2 === 0 ? 'driver' : 'passenger',
            location: { lat: 27.70 + i * 0.004, lng: 85.30 + i * 0.004 },
            address: `Incident spot ${i + 1}, Kathmandu`,
            contactPhone: `9810${String(100000 + i).slice(-6)}`,
            tripId: pick(trips, i)._id,
            message: 'Seeded demo emergency alert',
            status: pick(['active', 'acknowledged', 'resolved'], i),
        });
    }
    console.log(`Created ${N} emergencies`);

    // ---- Documents (for drivers) — each backed by a real, written PDF ----
    fs.rmSync(DOCS_DIR, { recursive: true, force: true });
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    const DOC_TYPES = ['citizenship', 'driving_license', 'police_clearance', 'vehicle_registration', 'insurance', 'bluebook'];
    const DOC_TITLES = {
        citizenship: 'Citizenship Certificate',
        driving_license: 'Driving License',
        police_clearance: 'Police Clearance Report',
        vehicle_registration: 'Vehicle Registration',
        insurance: 'Insurance Policy',
        bluebook: 'Vehicle Bluebook',
    };
    for (let i = 0; i < N; i++) {
        const drv = pick(drivers, i);
        const type = pick(DOC_TYPES, i);
        const status = pick(['pending', 'approved', 'rejected'], i);
        const expiry = daysAhead(365 + i);
        const fileName = `${type}-${i + 1}.pdf`;
        const pdf = makePdf(DOC_TITLES[type], [
            'Government of Nepal — Department of Transport',
            `Document Type: ${DOC_TITLES[type]}`,
            `Holder / Vehicle: ${drv.vehiclePlate}`,
            `License No.: ${drv.licenseNumber}`,
            `Issued: ${daysAgo(400).toDateString()}`,
            `Valid Until: ${expiry.toDateString()}`,
            `Reference: DOC-${100000 + i}`,
            '',
            'This is a seeded demo document generated for testing the',
            'Tempu admin dashboard document-verification workflow.',
        ]);
        fs.writeFileSync(path.join(DOCS_DIR, fileName), pdf);
        await Document.create({
            driverId: drv._id,
            type,
            fileUrl: `${DOCS_BASE_URL}/${fileName}`,
            status,
            expiresAt: expiry,
        });
    }
    console.log(`Created ${N} documents (real PDFs in public/docs/)`);

    // ---- Support tickets — distributed round-robin across the agent pool,
    // exactly like the app's auto-assignment. ~65% are resolved+rated, and each
    // rating accrues to that ticket's assigned agent. ----
    const CATS = ['trip_issue', 'payment_issue', 'driver_complaint', 'rider_complaint', 'document_issue', 'subscription_issue', 'account_issue', 'other'];
    const RATING_TAGS = ['Helpful', 'Fast', 'Polite', 'Resolved my issue'];
    const accrual = new Map(agents.map((a) => [String(a._id), { sum: 0, count: 0 }])); // per-agent rating totals
    const reviewDocs = []; // persistent reviews (survive ticket deletion)
    let ratedTotal = 0;
    for (let i = 0; i < N; i++) {
        const agent = agents[i % agents.length]; // round-robin, even distribution
        const rated = i % 3 !== 0; // ~2 of every 3 tickets get a rating
        const score = 3 + (i % 3); // 3..5
        const status = rated ? pick(['resolved', 'closed'], i) : pick(['open', 'in_progress'], i);
        const passenger = pick(passengers, i);
        const subject = `Demo ticket #${i + 1}: ${pick(CATS, i).replace('_', ' ')}`;
        const comment = `Great support, thank you (#${i + 1}).`;
        const tags = [pick(RATING_TAGS, i)];
        const ticket = await SupportTicket.create({
            userId: passenger._id,
            subject,
            category: pick(CATS, i),
            status,
            assignedTo: agent._id,
            messages: [{ senderType: 'user', text: 'Hello, I need help with my recent trip.' }],
            resolvedAt: rated ? daysAgo(i) : null,
            rating: rated
                ? { score, comment, tags, ratedAt: daysAgo(i), agentId: agent._id }
                : { score: null, comment: '', tags: [], ratedAt: null, agentId: null },
        });
        if (rated) {
            const a = accrual.get(String(agent._id)); a.sum += score; a.count += 1; ratedTotal++;
            reviewDocs.push({ agentId: agent._id, ticketId: ticket._id, subject, score, comment, tags, customer: passenger.name, ratedAt: daysAgo(i) });
        }
    }
    // Persistent review records — independent of the tickets above.
    await SupportReview.deleteMany({ agentId: { $in: agents.map((a) => a._id) } });
    if (reviewDocs.length) await SupportReview.insertMany(reviewDocs);
    console.log(`Created ${N} support tickets (${ratedTotal} rated), assigned across ${agents.length} agents`);

    // ---- Persist each agent's single support rating (independent of tickets) ----
    for (const agent of agents) {
        const { sum, count } = accrual.get(String(agent._id));
        const average = count ? Math.round((sum / count) * 10) / 10 : 0;
        await Admin.findByIdAndUpdate(agent._id, { supportRating: { sum, count, average } });
        if (count) console.log(`  ${agent.name}: ${average} (${count} ratings)`);
    }

    // ---- Reviews (trip feedback) ----
    for (let i = 0; i < N; i++) {
        const t = pick(trips, i);
        await Review.create({
            tripId: t._id,
            fromUser: t.userId,
            toDriver: t.driverId,
            rating: 3 + (i % 3),
            comment: 'Seeded demo review',
            reviewType: 'rider_to_driver',
        });
    }
    console.log(`Created ${N} reviews`);

    // ---- Notifications (insertMany bypasses the email-on-save hook) ----
    const NOTIF_TYPES = ['general', 'payment', 'trip_completed', 'trip_cancelled', 'subscription_alert', 'document_verified', 'account_approved'];
    const notifDocs = [];
    for (let i = 0; i < N; i++) {
        const toDriver = i % 2 === 0;
        notifDocs.push({
            userId: toDriver ? null : pick(passengers, i)._id,
            driverId: toDriver ? pick(drivers, i)._id : null,
            title: pick(['Payment received', 'Trip completed', 'Welcome to Tempu', 'Document verified', 'Subscription reminder'], i),
            body: `Seeded demo notification #${i + 1}.`,
            type: pick(NOTIF_TYPES, i),
            isRead: i % 3 === 0,
        });
    }
    await Notification.insertMany(notifDocs);
    console.log(`Created ${notifDocs.length} notifications`);

    await mongoose.disconnect();
    console.log('Done. Disconnected.');
}

run().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
