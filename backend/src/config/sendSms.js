import dotenv from 'dotenv';
dotenv.config();

// SMS delivery via Sparrow SMS (https://sparrowsms.com), the common Nepal
// gateway. Configure SPARROW_SMS_TOKEN (and optionally SPARROW_SMS_FROM, the
// approved sender identity) in .env to enable real delivery. Without a token
// this no-ops and just logs, so OTP flows still work via the terminal/email.
const SPARROW_SMS_TOKEN = process.env.SPARROW_SMS_TOKEN?.trim();
const SPARROW_SMS_FROM = process.env.SPARROW_SMS_FROM?.trim() || 'Demo';
const SPARROW_SMS_URL = 'https://api.sparrowsms.com/v2/sms/';

// Sparrow expects a 10-digit local Nepal number (98XXXXXXXX). Strip any '+',
// spaces, and the 977 country code we store on the user.
const normalizeNepaliPhone = (phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('977')) d = d.slice(3);
  return d;
};

const sendSms = async (phone, text) => {
  if (!SPARROW_SMS_TOKEN) {
    console.warn(`[sms] no gateway configured - not sent to ${phone} (code is in the terminal/email).`);
    return null;
  }
  try {
    const res = await fetch(SPARROW_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: SPARROW_SMS_TOKEN,
        from: SPARROW_SMS_FROM,
        to: normalizeNepaliPhone(phone),
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.response_code && data.response_code >= 400)) {
      console.error(`[sms] send failed -> ${phone}:`, data);
      return null;
    }
    console.log(`[sms] sent -> ${phone}`);
    return data;
  } catch (error) {
    console.error(`[sms] error -> ${phone}:`, error.message);
    return null;
  }
};

export { sendSms };
