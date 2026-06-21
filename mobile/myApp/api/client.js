import { Platform } from 'react-native';
import { tokenStore } from './tokenStore';

// For Android emulator: 10.0.2.2 maps to your machine's localhost
// For iOS simulator:    localhost works fine
// For physical device:  set EXPO_PUBLIC_API_URL to your machine's LAN IP
//   e.g. EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'
    : 'http://localhost:8000/api/v1');

let isRefreshing = false;
let waitQueue = [];

function flushQueue(err, token) {
  waitQueue.forEach((cb) => cb(err, token));
  waitQueue = [];
}

async function doRefresh() {
  const { refreshToken } = tokenStore.get();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Token refresh failed');
  const { accessToken, refreshToken: newRefresh } = json.data;
  await tokenStore.set(accessToken, newRefresh);
  return accessToken;
}

async function rawFetch(method, path, body, headers) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function request(method, path, body, opts = {}) {
  const { skipAuth = false, tempToken = null } = opts;
  const { accessToken } = tokenStore.get();

  const headers = { 'Content-Type': 'application/json' };
  if (tempToken) {
    headers.Authorization = `Bearer ${tempToken}`;
  } else if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await rawFetch(method, path, body, headers);
  } catch (networkErr) {
    throw new Error(
      'Cannot reach the server. Make sure the backend is running and your device can access it.'
    );
  }

  if (res.status === 401 && !skipAuth && !tempToken) {
    if (isRefreshing) {
      const newToken = await new Promise((resolve, reject) => {
        waitQueue.push((err, tok) => (err ? reject(err) : resolve(tok)));
      });
      headers.Authorization = `Bearer ${newToken}`;
      try {
        res = await rawFetch(method, path, body, headers);
      } catch {
        throw new Error('Cannot reach the server. Check your network connection.');
      }
    } else {
      isRefreshing = true;
      let newToken;
      try {
        newToken = await doRefresh();
        flushQueue(null, newToken);
      } catch (err) {
        flushQueue(err, null);
        isRefreshing = false;
        throw err;
      }
      isRefreshing = false;
      headers.Authorization = `Bearer ${newToken}`;
      try {
        res = await rawFetch(method, path, body, headers);
      } catch {
        throw new Error('Cannot reach the server. Check your network connection.');
      }
    }
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
};
