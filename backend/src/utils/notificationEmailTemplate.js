// Branded notification email with an optional call-to-action link button.
// Used by the Notification post-save hook so every in-app notification can also
// land in the user's inbox with a deep link back into the app / admin panel.
const notificationEmailTemplate = ({ name, title, body, link, linkLabel = 'View in Tempu' }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <h1 style="color: #ea580c;">Tempu 🛺</h1>
      <p>Hello ${name || 'there'},</p>

      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px 24px; margin: 16px 0;">
        <h2 style="margin: 0 0 8px; color: #9a3412; font-size: 18px;">${title}</h2>
        <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.5;">${body}</p>
      </div>

      ${link ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${link}" style="display: inline-block; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 12px 28px; border-radius: 10px;">
            ${linkLabel}
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or paste this link into your browser:<br/>${link}</p>
      ` : ''}

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">You're receiving this because of activity on your Tempu account.</p>
      <p style="color: #6b7280; font-size: 13px;">- The Tempu Team</p>
    </div>
  `;
};

export { notificationEmailTemplate };
