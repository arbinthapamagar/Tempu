const verifyEmailTemplate = ({ name, url }) => {
  return `

  <p style="color:red; background-color:blue; border:none; padding:10px; border-radius:5px; cursor:pointer; ">Hello ${name}</p>
    <h1>Welcome to VintunaStore</h1>
    <p>Thank you for registering with VintunaStore. We are excited to have you with us.</p>
    <p>Your account has been created successfully.</p>
    <p>Click on the button below to verify your email address.</p>
    <a href="${url}" style= " color:white; background-color:blue; border:none; padding:10px; border-radius:5px; cursor:pointer; ">Verify Email</a>
    <p>Thank you for choosing VintunaStore.</p>
    `;
};

export { verifyEmailTemplate };