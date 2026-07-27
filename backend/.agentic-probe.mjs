import mongoose from 'mongoose';
import { HANDLERS } from './src/utils/agenticTools.js';

await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME || ''}`);
console.log('connected:', mongoose.connection.name);

const { proposeAction } = await import('/home/arbin/Arbeen/Development/Shakti/backend/src/utils/agenticActions.js');

// ---- read tools: run every zero-arg / safe-default listing tool ----
const reads = [
  ['platform_stats', {}],
  ['list_support_tickets', { limit: 50 }],
  ['list_users', { limit: 3 }],
  ['list_drivers', { limit: 3 }],
  ['list_subscriptions', {}],
  ['list_transactions', { limit: 3 }],
  ['revenue_summary', { period: 'month' }],
  ['list_withdrawals', {}],
  ['list_documents', { status: 'pending' }],
  ['list_notifications', { limit: 3 }],
  ['list_admin_notifications', { limit: 3 }],
  ['list_support_agents', {}],
  ['get_support_settings', {}],
  ['get_map_settings', {}],
  ['api_log_stats', { period: 'week' }],
  ['list_api_logs', { onlyErrors: true, limit: 3 }],
  ['analytics_overview', { period: 'month' }],
  ['get_driver_availability', {}],
  ['list_reviews', { limit: 3 }],
  ['get_pricing_config', {}],
  ['list_active_emergencies', {}],
];

let failures = 0;
for (const [name, args] of reads) {
  try {
    const r = await HANDLERS[name](args);
    const brief = JSON.stringify(r);
    console.log(`OK   ${name.padEnd(26)} ${brief.slice(0, 150)}${brief.length > 150 ? '…' : ''}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name.padEnd(26)} ${e.message}`);
  }
}
console.log('\nread failures:', failures);
await mongoose.disconnect();
