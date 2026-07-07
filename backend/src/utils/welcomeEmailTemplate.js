import { emailShell } from './emailLayout.js';

// Body for a welcome email: heading, lead line, a ticked bullet list, a closing
// note and signature. Wrapped in the shared brand shell.
const welcomeBody = ({ heading, lead, bullets, footerNote }) => `
  <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${heading}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b5563;">${lead}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;">
    <tr><td style="padding:18px 20px;">
      ${bullets.map((b) => `<div style="font-size:14px;line-height:1.5;color:#374151;padding:6px 0;"><span style="color:#16a34a;font-weight:700;margin-right:8px;">&#10003;</span>${b}</div>`).join('')}
    </td></tr>
  </table>
  <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">${footerNote}</p>
  <p style="margin:24px 0 0;font-size:14px;color:#111827;">Cheers,<br/><strong>The Tempu Team</strong></p>
`;

const welcomeUserTemplate = ({ name }) =>
  emailShell({
    badge: 'ACCOUNT VERIFIED',
    accent: '#f97316',
    content: welcomeBody({
      heading: `Welcome aboard, ${name}! 🎉`,
      lead: 'Your Tempu account is verified and ready to go. Book a tuktuk, scooter or taxi in seconds and travel across the city with ease.',
      bullets: [
        'Book rides and deliveries anytime',
        'Track your driver live on the map',
        'Pay your way and rate every trip',
      ],
      footerNote: 'Open the Tempu app to take your first ride. Need help? Reach us any time from the in-app Support screen.',
    }),
  });

const welcomeDriverTemplate = ({ name }) =>
  emailShell({
    badge: 'DRIVER APPLICATION RECEIVED',
    accent: '#0f766e',
    content: welcomeBody({
      heading: `You're almost there, ${name}! 🛺`,
      lead: 'Thanks for signing up to drive with Tempu. Your driver profile has been submitted and is now pending admin approval.',
      bullets: [
        'Our team is reviewing your vehicle & license details',
        "You'll be notified once your account is approved",
        'After approval you can go online and start accepting trips',
      ],
      footerNote: 'Approvals are usually quick. Make sure your uploaded documents are clear and valid to avoid delays.',
    }),
  });

export { welcomeUserTemplate, welcomeDriverTemplate };
