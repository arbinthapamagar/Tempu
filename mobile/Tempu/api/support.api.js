import { api } from './client';

// Public, pre-login support enquiry — no auth needed.
export const supportPublicApi = {
  contact: (data) => api.post('/support/contact', data, { skipAuth: true }),
};
