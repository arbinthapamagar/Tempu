/**
 * Seed realistic TEST DATA for the Support, Documents and Emergency (SOS) surfaces.
 *
 *   node scripts/seedTestData.js          # create (idempotent — skips what already exists)
 *   FRESH=1 node scripts/seedTestData.js  # wipe previously-seeded test data first, then recreate
 *
 * What it creates:
 *   • A small pool of realistic riders + drivers (phones in the 9710-00000x range
 *     so this script can find and clean up only its own data).
 *   • Support tickets — real category/subject/status mixes, multi-message threads,
 *     a couple assigned to the super admin with internal notes.
 *   • Documents — real, publicly-reachable sample PDFs/images so the in-app PDF
 *     iframe + image lightbox actually render; mixed pending/approved/rejected.
 *   • Emergencies — fired through the REAL SOS endpoint (POST /api/v1/users/emergency)
 *     using a freshly-minted user access token, NOT a hard-coded DB insert. If the
 *     API server isn't reachable it falls back to a direct insert and says so.
 *
 * Requires the usual backend .env (MONGODB_URI, ACCESS_TOKEN_SECRET, …). For the
 * emergency step the dev server should be running (npm start); override its URL
 * with SEED_API_URL (default http://localhost:<PORT||8000>/api/v1).
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { DB_NAME } from '../src/utils/constant.js';
import { User } from '../src/models/user.model.js';
import { Driver } from '../src/models/driver.model.js';
import { Admin } from '../src/models/admin.model.js';
import { SupportTicket } from '../src/models/supportTicket.model.js';
import { Document } from '../src/models/doeument.model.js';
import { Emergency } from '../src/models/emergency.model.js';

const FRESH = process.env.FRESH === '1' || process.env.FRESH === 'true';
const API_URL = (process.env.SEED_API_URL || `http://localhost:${process.env.PORT || 8000}/api/v1`).replace(/\/$/, '');

// Real, publicly-hosted sample files so previews/iframe/download all work.
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const SAMPLE_PDF2 = 'https://pdfobject.com/pdf/sample.pdf';
const img = (seed) => `https://picsum.photos/seed/${seed}/1000/700`;

const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const pick = (arr, i) => arr[i % arr.length];

// ── Realistic people ──────────────────────────────────────────────────────────
// Phones all start 9710-00000x so we can find/clean only our own seed rows.
const RIDERS = [
  { name: 'Aarav Shrestha', phone: '9710000001', email: 'aarav.shrestha@example.com', rating: 4.8 },
  { name: 'Sita Maharjan', phone: '9710000002', email: 'sita.maharjan@example.com', rating: 4.6 },
  { name: 'Bibek Gurung', phone: '9710000003', email: 'bibek.gurung@example.com', rating: 4.2 },
  { name: 'Pooja Karki', phone: '9710000004', email: 'pooja.karki@example.com', rating: 3.4 },
];

const DRIVERS = [
  { name: 'Ramesh Tamang', phone: '9710000005', email: 'ramesh.tamang@example.com', vehicleType: 'taxi', vehiclePlate: 'BA-2-CHA-1456', vehicleModel: 'Suzuki Alto', vehicleColor: 'White', status: 'approved', isVerified: true, rating: 4.7, totalRides: 312, earnings: 184500 },
  { name: 'Krishna Bhandari', phone: '9710000006', email: 'krishna.bhandari@example.com', vehicleType: 'bike', vehiclePlate: 'BA-24-PA-7781', vehicleModel: 'Honda CB Shine', vehicleColor: 'Black', status: 'approved', isVerified: true, rating: 4.5, totalRides: 1043, earnings: 421300 },
  { name: 'Dipak Lama', phone: '9710000007', email: 'dipak.lama@example.com', vehicleType: 'scooter', vehiclePlate: 'BA-99-PA-2210', vehicleModel: 'Honda Dio', vehicleColor: 'Red', status: 'pending', isVerified: false, rating: 0, totalRides: 0, earnings: 0 },
  { name: 'Sunita Rai', phone: '9710000008', email: 'sunita.rai@example.com', vehicleType: 'comfort', vehiclePlate: 'BA-5-CHA-8830', vehicleModel: 'Hyundai i20', vehicleColor: 'Silver', status: 'approved', isVerified: true, rating: 4.9, totalRides: 76, earnings: 58200 },
];

const SEED_PHONES = [...RIDERS, ...DRIVERS].map((p) => p.phone);
const DEFAULT_PASSWORD = 'password';

async function dbConnect() {
  await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
  console.log('DB connected');
}

async function ensurePeople() {
  const riders = [];
  for (const r of RIDERS) {
    let user = await User.findOne({ phone: r.phone });
    if (!user) {
      user = await User.create({
        name: r.name, phone: r.phone, email: r.email, password: DEFAULT_PASSWORD,
        isPhoneVerified: true, accountStatus: 'active',
        rating: { average: r.rating, total: Math.round(r.rating * 7) },
        walletBalance: Math.round(r.rating * 50),
      });
      console.log(`  + rider ${r.name} (${r.phone})`);
    }
    riders.push(user);
  }

  const drivers = [];
  for (const d of DRIVERS) {
    let user = await User.findOne({ phone: d.phone });
    if (!user) {
      user = await User.create({
        name: d.name, phone: d.phone, email: d.email, password: DEFAULT_PASSWORD,
        isPhoneVerified: true, accountStatus: 'active',
        rating: { average: d.rating || 5, total: d.totalRides },
      });
      console.log(`  + driver-user ${d.name} (${d.phone})`);
    }
    let driver = await Driver.findOne({ userId: user._id });
    if (!driver) {
      driver = await Driver.create({
        userId: user._id,
        vehicleType: d.vehicleType,
        city: 'Kathmandu',
        vehiclePlate: d.vehiclePlate,
        vehicleModel: d.vehicleModel,
        vehicleColor: d.vehicleColor,
        vehicleYear: 2019,
        licenseNumber: `0${d.phone.slice(-7)}`,
        licenseExpiry: daysAgo(-540), // ~1.5y out
        status: d.status,
        isVerified: d.isVerified,
        rating: d.rating,
        totalRatings: Math.round((d.rating || 0) * 9),
        totalRides: d.totalRides,
        earnings: d.earnings,
        walletBalance: Math.round(d.earnings * 0.2),
      });
      console.log(`  + driver-profile ${d.name} (${d.vehiclePlate})`);
    }
    drivers.push({ user, driver });
  }
  return { riders, drivers };
}

// ── Support tickets ─────────────────────────────────────────────────────────
async function seedSupport(riders, drivers, superAdmin) {
  const ago = (mins) => new Date(Date.now() - mins * 60 * 1000);
  const driverUsers = drivers.map((d) => d.user);

  const defs = [
    {
      who: riders[0], subject: 'Driver took a longer route', category: 'trip_issue', status: 'in_progress',
      assign: true, comment: 'Checked the GPS trail — looks like a genuine diversion for road works. @Arbeen verifying fare.',
      thread: [
        ['user', 'My driver took a much longer route than the app showed and the fare was higher.', 90],
        ['admin', 'Thanks for flagging this — I am pulling up your trip’s GPS log now.', 70],
        ['user', 'Appreciate it. The map said 12 minutes but it took almost 25.', 60],
      ],
    },
    {
      who: riders[1], subject: 'Was charged twice for one ride', category: 'payment_issue', status: 'open',
      thread: [['user', 'I see two deductions in my wallet for the same trip this morning. Please refund one.', 30]],
    },
    {
      who: riders[2], subject: 'App crashes when I open my trip history', category: 'account_issue', status: 'resolved',
      resolvedAt: ago(60 * 26),
      thread: [
        ['user', 'Every time I tap on Trip History the app closes itself.', 60 * 30],
        ['admin', 'We pushed a fix in the latest update. Could you update the app and try again?', 60 * 28],
        ['user', 'Updated — working now, thank you!', 60 * 26],
      ],
    },
    {
      who: riders[3], subject: 'Driver behaviour complaint', category: 'driver_complaint', status: 'closed',
      assign: true, resolvedAt: ago(60 * 50),
      comment: 'Spoke to the driver, issued a warning. Closing.',
      thread: [
        ['user', 'The driver was rude and kept using his phone while driving.', 60 * 60],
        ['admin', 'I’m very sorry to hear that. We take this seriously and will follow up with the driver.', 60 * 55],
      ],
    },
    {
      who: driverUsers[0], asDriver: drivers[0].driver, subject: 'Payout not received this week', category: 'payment_issue', status: 'in_progress',
      assign: true,
      thread: [
        ['user', 'My weekly payout has not landed in my bank account yet.', 60 * 8],
        ['admin', 'Let me check with the finance team and get back to you today.', 60 * 6],
      ],
    },
    {
      who: driverUsers[2], asDriver: drivers[2].driver, subject: 'Document verification pending too long', category: 'document_issue', status: 'open',
      thread: [['user', 'I uploaded my licence and bluebook 3 days ago but I’m still pending. Can you review?', 60 * 4]],
    },
    {
      who: riders[0], subject: 'Lost phone in the vehicle', category: 'other', status: 'resolved', resolvedAt: ago(60 * 70),
      thread: [
        ['user', 'I think I left my phone on the back seat of my last ride.', 60 * 80],
        ['admin', 'We contacted the driver — he has your phone and will meet you at the pickup point.', 60 * 72],
        ['user', 'Got it back. Thank you so much!', 60 * 70],
      ],
    },
    {
      who: riders[1], subject: 'Subscription auto-renewed unexpectedly', category: 'subscription_issue', status: 'open',
      thread: [['user', 'My monthly pass renewed even though I had turned off auto-renew. Please help.', 60 * 2]],
    },
  ];

  let created = 0;
  for (const def of defs) {
    const exists = await SupportTicket.findOne({ userId: def.who._id, subject: def.subject });
    if (exists) continue;

    const messages = def.thread.map(([senderType, message, minsAgo]) => ({
      senderId: senderType === 'admin' ? (superAdmin?._id || def.who._id) : def.who._id,
      senderType,
      message,
      createdAt: ago(minsAgo),
    }));

    const doc = {
      userId: def.who._id,
      driverId: def.asDriver?._id || null,
      subject: def.subject,
      category: def.category,
      status: def.status,
      messages,
      resolvedAt: def.resolvedAt || null,
      assignedTo: def.assign && superAdmin ? superAdmin._id : null,
    };
    if (def.comment && superAdmin) {
      doc.comments = [{ authorId: superAdmin._id, body: def.comment, mentions: [], createdAt: ago(40) }];
    }
    await SupportTicket.create(doc);
    created += 1;
  }
  console.log(`Support: created ${created} ticket(s)${created === 0 ? ' (all already present)' : ''}`);
}

// ── Documents ─────────────────────────────────────────────────────────────────
async function seedDocuments(drivers) {
  // [type, fileUrl, status, rejectionReason?, expiresInDays?]
  const plans = [
    [
      ['driving_license', img('license-ramesh'), 'approved', null, 400],
      ['citizenship', img('citizenship-ramesh'), 'approved'],
      ['vehicle_registration', SAMPLE_PDF, 'approved', null, 300],
      ['insurance', SAMPLE_PDF2, 'pending', null, 120],
      ['police_clearance', img('police-ramesh'), 'approved'],
    ],
    [
      ['driving_license', img('license-krishna'), 'approved', null, 500],
      ['bluebook', SAMPLE_PDF, 'approved'],
      ['insurance', SAMPLE_PDF2, 'rejected', 'Insurance certificate has expired. Please upload a current policy.'],
      ['citizenship', img('citizenship-krishna'), 'approved'],
    ],
    [
      ['driving_license', img('license-dipak'), 'pending'],
      ['citizenship', img('citizenship-dipak'), 'pending'],
      ['bluebook', SAMPLE_PDF, 'pending'],
      ['police_clearance', SAMPLE_PDF2, 'rejected', 'Document is blurry and unreadable. Please re-scan and upload again.'],
    ],
    [
      ['driving_license', img('license-sunita'), 'approved', null, 600],
      ['vehicle_registration', SAMPLE_PDF, 'approved', null, 450],
      ['insurance', SAMPLE_PDF2, 'pending', null, 200],
    ],
  ];

  let created = 0;
  for (let i = 0; i < drivers.length; i += 1) {
    const { driver } = drivers[i];
    const plan = pick(plans, i);
    for (const [type, fileUrl, status, rejectionReason = null, expiresInDays] of plan) {
      const exists = await Document.findOne({ driverId: driver._id, type });
      if (exists) continue;
      await Document.create({
        driverId: driver._id,
        type,
        fileUrl,
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        verifiedAt: status === 'pending' ? null : daysAgo(2),
        expiresAt: expiresInDays ? daysAgo(-expiresInDays) : null,
      });
      created += 1;
    }
  }
  console.log(`Documents: created ${created} document(s)${created === 0 ? ' (all already present)' : ''}`);
}

// Fire one SOS through the REAL endpoint; fall back to a direct insert if the
// server is unreachable. Returns { id, viaEndpoint } so callers can post-process
// (e.g. mark it acknowledged/resolved — an admin action, not part of the SOS).
async function fireSos(e) {
  const token = e.actor.generateAccessToken();
  const body = { lat: e.lat, lng: e.lng, address: e.address, message: e.message, role: e.role };
  try {
    const res = await fetch(`${API_URL}/users/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      return { id: json?.data?._id || null, viaEndpoint: true };
    }
    console.warn(`  ! endpoint returned ${res.status} for ${e.actor.name}`);
  } catch (err) {
    console.warn(`  ! could not reach ${API_URL} (${err.code || err.message})`);
  }
  // Fallback so the script still yields data when the server is down.
  const driver = e.role === 'driver' ? await Driver.findOne({ userId: e.actor._id }).select('_id') : null;
  const created = await Emergency.create({
    userId: e.actor._id,
    driverId: driver?._id || null,
    role: e.role,
    location: { lat: e.lat, lng: e.lng },
    address: e.address,
    contactPhone: e.actor.phone,
    message: e.message,
    status: 'active',
  });
  return { id: created._id, viaEndpoint: false };
}

// ── Emergencies — through the REAL SOS endpoint ────────────────────────────────
async function seedEmergencies(riders, drivers, superAdmin) {
  // Realistic Kathmandu-valley coordinates + addresses. `resolve` marks how the
  // alert should end up — the SOS always fires live as 'active', then we apply
  // the admin handling step directly (there's no public resolve endpoint).
  const events = [
    { actor: riders[0], role: 'passenger', lat: 27.7172, lng: 85.3240, address: 'Durbar Marg, Kathmandu', message: 'Feeling unsafe, driver is not following the route.' },
    { actor: riders[2], role: 'passenger', lat: 27.6710, lng: 85.4298, address: 'Suryabinayak, Bhaktapur', message: 'Minor accident — need assistance.' },
    { actor: drivers[1].user, role: 'driver', lat: 27.6788, lng: 85.3492, address: 'Koteshwor Chowk, Kathmandu', message: 'Passenger is being aggressive, requesting help.' },
    { actor: riders[1], role: 'passenger', lat: 27.7406, lng: 85.3360, address: 'Lazimpat, Kathmandu', message: 'SOS — vehicle broke down in an unsafe area at night.' },
    { actor: drivers[0].user, role: 'driver', lat: 27.7016, lng: 85.3206, address: 'Kalimati, Kathmandu', message: 'Medical emergency, passenger unwell.' },
    // These get transitioned to acknowledged / resolved after firing.
    { actor: riders[3], role: 'passenger', lat: 27.6588, lng: 85.3247, address: 'Satdobato, Lalitpur', message: 'Driver stopped at an unknown location.', resolve: 'acknowledged' },
    { actor: drivers[3].user, role: 'driver', lat: 27.7295, lng: 85.3439, address: 'Chabahil, Kathmandu', message: 'Roadside collision, no injuries.', resolve: 'resolved' },
    { actor: riders[2], role: 'passenger', lat: 27.6892, lng: 85.3180, address: 'Kalanki, Kathmandu', message: 'Felt threatened during the ride — now safe.', resolve: 'resolved' },
  ];

  // Skip if we already have all of them (avoid piling up on re-runs).
  const existing = await Emergency.countDocuments();
  if (existing >= events.length && !FRESH) {
    console.log(`Emergencies: ${existing} already present — skipping (run with FRESH=1 to reset).`);
    return;
  }

  let viaEndpoint = 0;
  let viaFallback = 0;
  let acknowledged = 0;
  let resolved = 0;
  for (const e of events) {
    const { id, viaEndpoint: live } = await fireSos(e);
    if (live) viaEndpoint += 1; else viaFallback += 1;

    if (e.resolve && id) {
      const updates = {
        status: e.resolve,
        handledBy: superAdmin?._id || null,
        acknowledgedAt: daysAgo(0.04), // ~1h ago
      };
      if (e.resolve === 'resolved') updates.resolvedAt = new Date();
      await Emergency.findByIdAndUpdate(id, updates);
      if (e.resolve === 'acknowledged') acknowledged += 1; else resolved += 1;
    }
  }
  console.log(`Emergencies: ${viaEndpoint} via SOS endpoint, ${viaFallback} via direct fallback (${acknowledged} acknowledged, ${resolved} resolved, rest active).`);
  if (viaFallback > 0) console.log(`  (start the API server — npm start — for a true end-to-end SOS, or set SEED_API_URL)`);
}

async function wipeSeeded() {
  const users = await User.find({ phone: { $in: SEED_PHONES } }).select('_id');
  const userIds = users.map((u) => u._id);
  const drivers = await Driver.find({ userId: { $in: userIds } }).select('_id');
  const driverIds = drivers.map((d) => d._id);

  const t = await SupportTicket.deleteMany({ userId: { $in: userIds } });
  const d = await Document.deleteMany({ driverId: { $in: driverIds } });
  const em = await Emergency.deleteMany({ userId: { $in: userIds } });
  console.log(`FRESH: removed ${t.deletedCount} tickets, ${d.deletedCount} documents, ${em.deletedCount} emergencies (seeded users kept).`);
}

async function run() {
  await dbConnect();

  const superAdmin = await Admin.findOne({ role: 'superadmin' });
  if (!superAdmin) console.warn('No super admin found — tickets will be created unassigned. Run `npm run seed` first.');

  if (FRESH) await wipeSeeded();

  console.log('Ensuring test riders & drivers…');
  const { riders, drivers } = await ensurePeople();

  await seedSupport(riders, drivers, superAdmin);
  await seedDocuments(drivers);
  await seedEmergencies(riders, drivers, superAdmin);

  console.log('\nTest data seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
