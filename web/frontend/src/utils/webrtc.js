// Shared WebRTC config for in-app support calls.
// Free Google STUN by default; plug in a TURN server (coturn / a free tier) via
// env for reliable connectivity across mobile carrier NATs.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      }]
    : []),
]

// socket.io server lives at the API origin (without the /api/v1 path).
export const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace(/\/api\/v1\/?$/, '')
