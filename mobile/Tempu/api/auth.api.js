import { api } from './client';

export const authApi = {
  register: (data) => api.post('/auth/register', data, { skipAuth: true }),
  verifyOtp: (otp, tempToken) =>
    api.post('/auth/verify-otp', { otp }, { skipAuth: true, tempToken }),
  resendOtp: (tempToken) =>
    api.post('/auth/resend-otp', {}, { skipAuth: true, tempToken }),
  login: (phone, password) =>
    api.post('/auth/login', { phone, password }, { skipAuth: true }),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (phone) =>
    api.post('/auth/forgot-password', { phone }, { skipAuth: true }),
  resetPassword: (otp, newPassword, confirmPassword, tempToken) =>
    api.post(
      '/auth/reset-password',
      { otp, newPassword, confirmPassword },
      { skipAuth: true, tempToken }
    ),
};
