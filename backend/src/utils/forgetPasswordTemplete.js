import { emailShell, codeBlock } from './emailLayout.js';

const forgetPasswordTemplate = ({ name, otp }) =>
  emailShell({
    badge: 'PASSWORD RESET',
    accent: '#f97316',
    content: `
      <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Hi ${name || 'there'},</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563;">We received a request to reset your Tempu password. Enter the code below in the app to continue.</p>
      ${otp ? codeBlock(otp) : ''}
      <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">This code is valid for <strong>10 minutes</strong>.</p>
      <p style="margin:0;font-size:13px;color:#9ca3af;">If you didn't request a password reset, ignore this email - your password stays unchanged. Never share this code with anyone.</p>
    `,
  });

export { forgetPasswordTemplate };
