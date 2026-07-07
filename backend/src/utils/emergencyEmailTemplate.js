import { emailShell } from './emailLayout.js';

// Reassurance email sent to the customer when an admin acts on their SOS alert.
// `status` is 'acknowledged' (responding) or 'resolved'.
const emergencyEmailTemplate = ({ name, status }) => {
  const resolved = status === 'resolved';
  const accent = resolved ? '#16a34a' : '#dc2626';
  const boxBg = resolved ? '#f0fdf4' : '#fef2f2';
  const boxBorder = resolved ? '#bbf7d0' : '#fecaca';
  const boxText = resolved ? '#15803d' : '#b91c1c';

  return emailShell({
    badge: resolved ? '✅ EMERGENCY RESOLVED' : '🚨 HELP IS ON THE WAY',
    accent,
    content: `
      <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">${resolved ? `You're safe now, ${name || 'there'}` : `We've got you, ${name || 'there'}`}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563;">
        ${resolved
          ? "Your SOS alert has been reviewed and marked resolved by our safety team. We're relieved you're okay."
          : 'Our safety team has received your SOS alert and is actively responding right now. Please stay calm - help is on the way.'}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${boxBg};border:1px solid ${boxBorder};border-radius:10px;">
        <tr><td style="padding:16px 20px;">
          <div style="font-size:14px;line-height:1.6;color:${boxText};">
            <span style="font-weight:700;margin-right:8px;">&#10003;</span>Alert status: <strong>${resolved ? 'Resolved' : 'Being handled'}</strong>
          </div>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">If you are still in danger, contact local emergency services immediately - Police <strong>100</strong> / Ambulance <strong>102</strong>.</p>
      <p style="margin:18px 0 0;font-size:14px;color:#111827;">Your safety matters,<br/><strong>The Tempu Safety Team</strong></p>
    `,
  });
};

export { emergencyEmailTemplate };
