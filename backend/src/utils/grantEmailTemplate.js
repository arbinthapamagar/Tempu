import { emailShell } from './emailLayout.js';

const row = (label, value) => `
  <tr>
    <td style="padding:11px 0;font-size:13px;color:#6b7280;border-bottom:1px solid #eef0f2;">${label}</td>
    <td style="padding:11px 0;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #eef0f2;">${value}</td>
  </tr>`;

const grantEmailTemplate = ({ name, amount, note, balance, reference }) =>
  emailShell({
    badge: 'WALLET CREDIT',
    accent: '#f97316',
    content: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Dear ${name || 'Driver'},</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563;">This is to confirm that a credit has been added to your Tempu driver wallet by our team. The details are below.</p>

      <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#f9fafb;padding:22px 24px;text-align:center;border-bottom:1px solid #eef0f2;">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.6px;color:#6b7280;text-transform:uppercase;">Amount credited</div>
          <div style="margin-top:6px;font-size:32px;font-weight:700;color:#15803d;">NPR ${Number(amount || 0).toLocaleString()}</div>
        </div>
        <div style="padding:6px 24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row('Status', 'Credited')}
            ${row('Type', 'Wallet top-up')}
            ${reference ? row('Reference', String(reference).slice(-10).toUpperCase()) : ''}
            ${balance != null ? row('New wallet balance', `NPR ${Number(balance).toLocaleString()}`) : ''}
          </table>
        </div>
      </div>

      ${note ? `
        <p style="margin:22px 0 6px;font-size:13px;color:#6b7280;">Note from the team</p>
        <p style="background:#f9fafb;border:1px solid #eef0f2;border-radius:8px;padding:12px 16px;margin:0;font-size:14px;color:#374151;">${note}</p>
      ` : ''}

      <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">This amount is now part of your withdrawable balance. You can withdraw it to your bank, Khalti or eSewa from the Tempu driver app.</p>
      <p style="margin:20px 0 0;font-size:14px;color:#111827;">Regards,<br/><strong>The Tempu Team</strong></p>
    `,
  });

export { grantEmailTemplate };
