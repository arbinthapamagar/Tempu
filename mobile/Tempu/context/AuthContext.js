import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth.api';
import { tokenStore } from '../api/tokenStore';
import { userApi } from '../api/user.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tempToken, setTempToken] = useState(null);

  // On mount, try to restore session from stored tokens. Only a real rejection
  // of the session clears them; if the backend is just unreachable (restarting,
  // offline) keep them and retry a few times, so a reload at the wrong moment
  // doesn't sign the user out.
  useEffect(() => {
    (async () => {
      try {
        const { accessToken } = await tokenStore.load();
        if (!accessToken) return;
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await userApi.getProfile();
            setUser(res.data);
            return;
          } catch (err) {
            if (!err?.network) {
              await tokenStore.clear();
              return;
            }
            if (attempt >= 4) return; // still unreachable: keep tokens for next launch
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
      } catch {
        // storage unavailable — stay signed out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (phone, password) => {
    const res = await authApi.login(phone, password);
    const { user: u, accessToken, refreshToken } = res.data;
    await tokenStore.set(accessToken, refreshToken);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authApi.register(data);
    const { tempToken: token } = res.data;
    setTempToken(token);
    return token;
  }, []);

  const verifyOtp = useCallback(
    async (otp) => {
      if (!tempToken) throw new Error('No temp token - start registration again');
      const res = await authApi.verifyOtp(otp, tempToken);
      const { user: u, accessToken, refreshToken } = res.data;
      await tokenStore.set(accessToken, refreshToken);
      setUser(u);
      setTempToken(null);
      return u;
    },
    [tempToken]
  );

  const resendOtp = useCallback(async () => {
    if (!tempToken) throw new Error('No temp token');
    await authApi.resendOtp(tempToken);
  }, [tempToken]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort - clear local state regardless
    }
    await tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await userApi.getProfile();
    setUser(res.data);
    return res.data;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, tempToken, login, register, verifyOtp, resendOtp, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
