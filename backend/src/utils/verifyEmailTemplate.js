import { emailShell, codeBlock } from './emailLayout.js';

const verifyEmailTemplate = ({ name, otp, url }) =>
  emailShell({
    badge: 'VERIFY YOUR ACCOUNT',
    accent: '#f97316',
    content: `
      <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Hello ${name || 'there'} 👋</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563;">Use the verification code below to confirm your Tempu account.</p>
      ${otp ? codeBlock(otp) : ''}
      <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>.</p>
      <p style="margin:0;font-size:13px;color:#9ca3af;">Didn't request this? You can safely ignore this email. Never share this code with anyone.</p>
      ${url ? `<div style="text-align:center;margin-top:22px;"><a href="${url}" style="color:#ffffff;background:#f97316;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a></div>` : ''}
    `,
  });

export { verifyEmailTemplate };
