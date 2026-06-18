import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Gmail SMTP transport. Uses a Google "App Password" (not the normal account
// password) — generate one at https://myaccount.google.com/apppasswords with
// 2-Step Verification enabled, then set GMAIL_USER + GMAIL_APP_PASSWORD in .env.
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn('GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will not be sent');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
};

const sendEmail = async ({ sendTo, subject, html }) => {
  if (!sendTo) return null;

  const tx = getTransporter();
  if (!tx) return null;

  const fromName = process.env.MAIL_FROM_NAME || 'Tempu';
  const fromAddress = process.env.GMAIL_USER;

  try {
    const info = await tx.sendMail({
      from: `${fromName} <${fromAddress}>`,
      to: sendTo,
      subject,
      html,
    });
    return info;
  } catch (error) {
    console.error('sendEmail error:', error.message);
    return null;
  }
};

export { sendEmail };
