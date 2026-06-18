const grantEmailTemplate = ({ name, amount, note }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <h1 style="color: #ea580c;">Tempu 🛺</h1>
      <p>Hello ${name || 'there'},</p>

      <p>Good news — funds have been added to your Tempu driver wallet.</p>

      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
        <p style="margin: 0; color: #9a3412; font-size: 14px;">Amount granted</p>
        <p style="margin: 8px 0 0; color: #ea580c; font-size: 32px; font-weight: bold;">NPR ${Number(amount || 0).toLocaleString()}</p>
      </div>

      ${note ? `
        <p style="color: #6b7280; font-size: 14px;">Reason / note:</p>
        <p style="background: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px;">${note}</p>
      ` : ''}

      <p>This amount is now part of your withdrawable wallet balance. You can cash it out to your bank, Khalti or eSewa from the Tempu driver app.</p>

      <p>Thanks for driving with us,<br/>The Tempu Team</p>
    </div>
  `;
};

export { grantEmailTemplate };
