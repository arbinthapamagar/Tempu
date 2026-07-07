import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER?.trim();
// App passwords are shown by Google as 4 groups of 4 with spaces ("abcd efgh
// ijkl mnop"); nodemailer needs them without spaces.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Tempu';

let transporter = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
} else {
  console.warn(
    '[email] GMAIL_USER / GMAIL_APP_PASSWORD not set - emails will NOT be sent. ' +
    'OTP codes still print in the server terminal.'
  );
}

// Sends an email via Gmail SMTP. If credentials are missing it no-ops (returns
// null) instead of throwing, so registration/OTP flows still succeed and the
// code stays readable from the terminal log.
const sendEmail = async ({ sendTo, subject, html }) => {
  if (!transporter) {
    console.warn(`[email] skipped (no SMTP creds): "${subject}" -> ${sendTo}`);
    return null;
  }
  try {
    const info = await transporter.sendMail({
      from: `${MAIL_FROM_NAME} <${GMAIL_USER}>`,
      to: sendTo,
      subject,
      html,
    });
    console.log(`[email] sent "${subject}" -> ${sendTo} (id: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`[email] send failed -> ${sendTo}:`, error.message);
    return null;
  }
};

export { sendEmail };
