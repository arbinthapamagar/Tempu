import { BASE_URL } from '../api/client';

// Free Google STUN by default; set EXPO_PUBLIC_TURN_* to add a TURN relay for
// reliable connectivity across mobile carrier NATs.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(process.env.EXPO_PUBLIC_TURN_URL
    ? [{
        urls: process.env.EXPO_PUBLIC_TURN_URL,
        username: process.env.EXPO_PUBLIC_TURN_USERNAME,
        credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
      }]
    : []),
];

// socket.io server is at the API origin (without the /api/v1 path).
export const SOCKET_URL = BASE_URL.replace(/\/api\/v1\/?$/, '');
