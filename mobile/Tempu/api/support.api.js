import { api } from './client';

// Public, pre-login support - no auth needed. The guest chat thread is gated by
// a random token returned when the thread is created.
export const supportPublicApi = {
  contact: (data) => api.post('/support/contact', data, { skipAuth: true }),

  // Live chat for people without an account.
  startChat: (data) => api.post('/support/ticket', data, { skipAuth: true }),
  getChat: (id, token) =>
    api.get(`/support/ticket/${id}?token=${encodeURIComponent(token)}`, { skipAuth: true }),
  sendChatMessage: (id, token, message) =>
    api.post(`/support/ticket/${id}/messages`, { token, message }, { skipAuth: true }),
};
