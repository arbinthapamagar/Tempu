import 'dotenv/config';
import mongoose from 'mongoose';
import { DB_NAME } from './src/utils/constant.js';
await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

const { proposeAction, ACTIONS, canRunAction } = await import('./src/utils/agenticActions.js');
const { Admin } = await import('./src/models/admin.model.js');
const boss = await Admin.findOne({ role: 'superadmin' });
console.log('acting as:', boss.name, `(${boss.role})\n`);

const show = async (label, name, args, admin = boss) => {
  const r = await proposeAction(name, args, admin);
  if (!r.ok) { console.log(`✗ ${label}\n    ${r.error}\n`); return null; }
  const p = r.proposal;
  console.log(`✓ ${label}`);
  console.log(`    [${p.label}] ${p.summary}`);
  p.fields.forEach(f => console.log(`      ${String(f.label).padEnd(14)} ${String(f.value).slice(0,80)}`));
  console.log(`      token ${p.token.slice(0, 28)}…\n`);
  return p;
};

// The headline use case: "tell this user this message"
await show('send_notification → rider by name', 'send_notification',
  { recipientType: 'user', recipientQuery: 'Anita', title: 'Account update', body: 'Your ride credit has been applied.' });

await show('send_notification → driver by name', 'send_notification',
  { recipientType: 'driver', recipientQuery: 'Hari Karki', title: 'Reminder', body: 'Please renew your insurance document.' });

await show('broadcast_notification → everyone', 'broadcast_notification',
  { audience: 'all', title: 'Scheduled maintenance', body: 'The app will be briefly unavailable tonight.' });

await show('reply_to_support_ticket', 'reply_to_support_ticket',
  { query: 'Hi', message: 'Thanks for reaching out — we are looking into this now.' });

await show('grant_driver_money', 'grant_driver_money',
  { driverQuery: 'Hari Karki', amount: 2500, note: 'Fuel reimbursement' });

await show('process_withdrawal (by driver)', 'process_withdrawal',
  { driverQuery: 'Gita Shrestha', action: 'approve' });

await show('verify_document (driver + type)', 'verify_document',
  { driverQuery: 'Nabin Adhikari', type: 'vehicle_registration' });

await show('set_user_status → suspend', 'set_user_status', { userQuery: 'Anita', status: 'suspended' });
await show('update_pricing', 'update_pricing', { commissionPercent: 12 });
await show('update_map_settings', 'update_map_settings', { provider: 'osm' });

console.log('── validation & gating ──');
await show('unknown recipient', 'send_notification', { recipientType: 'user', recipientQuery: 'Zzzznobody', title: 'x', body: 'y' });
await show('missing body', 'send_notification', { recipientType: 'user', recipientQuery: 'Anita', title: 'x', body: '  ' });
await show('nonsense pricing (150%)', 'update_pricing', { commissionPercent: 150 });
await show('reject_document with no reason', 'reject_document', { driverQuery: 'Nabin Adhikari', reason: '' });

const mod = { _id: boss._id, role: 'moderator', permissions: { handleSupport: true } };
await show('moderator tries update_pricing', 'update_pricing', { commissionPercent: 12 }, mod);
await show('moderator tries grant money', 'grant_driver_money', { driverQuery: 'Hari Karki', amount: 100 }, mod);

// Nothing above should have written anything.
const { Notification } = await import('./src/models/notification.model.js');
const { Transaction } = await import('./src/models/transaction.model.js');
console.log('── side-effect check (propose must not write) ──');
console.log('notifications:', await Notification.countDocuments({}), '| transactions:', await Transaction.countDocuments({}));
await mongoose.disconnect();
