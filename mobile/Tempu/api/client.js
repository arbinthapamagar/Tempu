import { Platform } from 'react-native';
import { tokenStore } from './tokenStore';

// For Android emulator: 10.0.2.2 maps to your machine's localhost
// For iOS simulator:    localhost works fine
// For physical device:  set EXPO_PUBLIC_API_URL to your machine's LAN IP
//   e.g. EXPO_PUBLIC_API_URL=http://192.168.1.100:8002/api/v1
// 8002 is the backend dev port (backend/.env, docker-compose, Makefile all agree).
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8002/api/v1'
    : 'http://localhost:8002/api/v1');

// Without this, an unreachable backend (spun-down host that completes the TLS
// handshake and then never answers) leaves every screen spinning until RN's
// own socket timeout — minutes on Android. Fail fast with a real message.
const REQUEST_TIMEOUT_MS = 15000;

// Uploads (avatar, documents, voice notes) need far longer than JSON calls.
const UPLOAD_TIMEOUT_MS = 120000;

let isRefreshing = false;
let waitQueue = [];

// Called when the refresh token itself is rejected (expired, or replaced by a
// login on another device). AuthProvider registers this to sign the user out;
// without it the app sat on its main screens failing every request.
let onAuthFailure = null;
export function setOnAuthFailure(fn) {
  onAuthFailure = fn;
}

function flushQueue(err, token) {
  waitQueue.forEach((cb) => cb(err, token));
  waitQueue = [];
}

// Parse a response body without letting a non-JSON body (an HTML 502 from a
// proxy while the host wakes up) surface as a SyntaxError — callers would
// otherwise treat that as "session rejected" and sign the user out.
async function readJson(res) {
  const json = await res.json().catch(() => null);
  if (json === null && (res.status >= 500 || res.status === 0)) throw networkError();
  return json;
}

async function doRefresh() {
  const { refreshToken } = tokenStore.get();
  if (!refreshToken) throw new Error('No refresh token');
  // If logout() clears the store while this is in flight, don't write the
  // refreshed tokens back — that would resurrect the session on next launch.
  const session = tokenStore.session();
  // Via rawFetch so the refresh call gets the same timeout as everything else.
  let res;
  try {
    res = await rawFetch('POST', '/auth/refresh-token', { refreshToken }, {
      'Content-Type': 'application/json',
      'X-Client': 'mobile',
    });
  } catch {
    throw networkError();
  }
  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message || 'Token refresh failed');
  const { accessToken, refreshToken: newRefresh } = json.data;
  if (tokenStore.session() !== session) throw new Error('Signed out');
  await tokenStore.set(accessToken, newRefresh);
  return accessToken;
}

// Thrown when the backend can't be reached at all (down, restarting, offline),
// as opposed to answering with an error. Callers use `err.network` to tell
// "try again later" apart from "your session is no longer valid".
function networkError() {
  const err = new Error('App is down. Please try again later.');
  err.network = true;
  return err;
}

const isFormData = (body) => typeof FormData !== 'undefined' && body instanceof FormData;

async function rawFetch(method, path, body, headers, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData(body) ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function request(method, path, body, opts = {}) {
  const { skipAuth = false, tempToken = null } = opts;
  const form = isFormData(body);
  const timeoutMs = opts.timeoutMs ?? (form ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  const { accessToken } = tokenStore.get();

  // X-Client tags every request so the backend API-Log viewer buckets this
  // traffic under the "Mobile" section (the web admin sends 'web').
  // FormData must not get a Content-Type: fetch sets the multipart boundary.
  const headers = form ? { 'X-Client': 'mobile' } : { 'Content-Type': 'application/json', 'X-Client': 'mobile' };
  if (tempToken) {
    headers.Authorization = `Bearer ${tempToken}`;
  } else if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await rawFetch(method, path, body, headers, timeoutMs);
  } catch {
    throw networkError();
  }

  if (res.status === 401 && !skipAuth && !tempToken) {
    let newToken;
    if (isRefreshing) {
      newToken = await new Promise((resolve, reject) => {
        waitQueue.push((err, tok) => (err ? reject(err) : resolve(tok)));
      });
    } else {
      isRefreshing = true;
      try {
        newToken = await doRefresh();
        flushQueue(null, newToken);
      } catch (err) {
        flushQueue(err, null);
        if (!err?.network && onAuthFailure) onAuthFailure();
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    headers.Authorization = `Bearer ${newToken}`;
    try {
      res = await rawFetch(method, path, body, headers, timeoutMs);
    } catch {
      throw networkError();
    }
  }

  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json;
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
};
