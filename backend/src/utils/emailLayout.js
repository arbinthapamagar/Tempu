// Shared, email-client-safe brand shell (inline styles, table-based) used by
// every transactional email so they all look consistent. `accent` themes the
// header/badge; `content` is the inner HTML for the body card.
const emailShell = ({ badge, accent = '#f97316', content }) => `
  <div style="margin:0;padding:0;background:#f4f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background:${accent};padding:32px 32px 28px;text-align:center;">
              <div style="font-size:30px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">TEM<span style="color:#ffe6d1;">PU</span> 🛺</div>
              ${badge ? `<div style="margin-top:10px;display:inline-block;background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.5px;padding:5px 12px;border-radius:999px;">${badge}</div>` : ''}
            </td>
          </tr>
          <tr><td style="padding:32px;">${content}</td></tr>
          <tr>
            <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #eef0f2;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© Tempu - ride • deliver • earn. This is an automated message, please don't reply.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </div>
`;

// A prominent, monospace, letter-spaced code chip themed to `accent`.
const codeBlock = (otp, accent = '#ea580c', bg = '#fff7ed', border = '#fed7aa') => `
  <div style="text-align:center;margin:8px 0 22px;">
    <div style="display:inline-block;background:${bg};border:1px solid ${border};border-radius:12px;padding:18px 28px;">
      <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:${accent};font-family:'Courier New',monospace;">${otp}</span>
    </div>
  </div>
`;

export { emailShell, codeBlock };
