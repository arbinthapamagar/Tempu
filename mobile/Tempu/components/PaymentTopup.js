import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';
import { PaymentLogo } from './Brand';

// Gateway top-ups (eSewa / Khalti). The app never credits anything itself:
// it asks the backend to start a payment, opens the gateway in the browser,
// and when the user comes back it asks the backend for the result — the
// backend confirms with the gateway before any money is added.

// One slot per target, so a driver top-up never overwrites a pending wallet one.
const pendingKey = (target) => `tempu_pending_topup:${target}`;
const POLL_EVERY_MS = 2500;
const POLL_TRIES = 12; // ~30s after returning to the app

const api = {
  wallet: { initiate: userApi.initiateWalletTopup, status: userApi.getWalletTopup },
  driver: { initiate: userApi.initiateDriverTopup, status: userApi.getDriverTopup },
};

// Which gateways the backend has configured (Khalti hides until its key is set).
export function usePaymentMethods() {
  const [methods, setMethods] = useState(null);
  useEffect(() => {
    let alive = true;
    userApi.getPaymentMethods()
      .then((r) => { if (alive) setMethods(r.data?.methods || []); })
      .catch(() => { if (alive) setMethods([{ id: 'esewa', label: 'eSewa', enabled: true }]); });
    return () => { alive = false; };
  }, []);
  return methods;
}

/**
 * target: 'wallet' (rider wallet) | 'driver' (driver prepaid fee balance)
 * onSettled({ status, amount, balance }) runs once a payment completes or fails.
 */
export function useGatewayTopup(target, onSettled) {
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const pendingRef = useRef(null); // { id, target }
  const checkingRef = useRef(false); // one poll loop at a time
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  const clearPending = useCallback(async () => {
    pendingRef.current = null;
    try { await AsyncStorage.removeItem(pendingKey(target)); } catch { /* ignore */ }
  }, [target]);

  const check = useCallback(async () => {
    const p = pendingRef.current;
    if (!p || p.target !== target) return;
    // Coming back from the browser fires AppState 'active' while a loop may
    // already be running; a second loop would alert and settle twice.
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      for (let i = 0; i < POLL_TRIES; i++) {
        let res;
        try {
          res = await api[target].status(p.id);
        } catch (e) {
          if (!e?.network) { await clearPending(); return; } // e.g. 404 — nothing to wait for
          res = null;
        }
        const d = res?.data;
        if (d && d.status !== 'pending') {
          await clearPending();
          settledRef.current?.({
            status: d.status,
            amount: d.amount,
            balance: target === 'driver' ? d.topupBalance : d.walletBalance,
          });
          if (d.status === 'completed') {
            Alert.alert('Top-up successful', `Rs ${d.amount} has been added.`);
          } else {
            Alert.alert('Payment not completed', 'You were not charged. You can try again.');
          }
          return;
        }
        if (pendingRef.current !== p) return; // superseded
        await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
      }
      // Still pending: keep it stored; we'll check again next time.
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [target, clearPending]);

  // Resume a payment left pending (app was closed while paying), and re-check
  // every time the user switches back from the browser.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(pendingKey(target));
        const p = raw ? JSON.parse(raw) : null;
        if (alive && p?.target === target) { pendingRef.current = p; check(); }
      } catch { /* ignore */ }
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && pendingRef.current) check();
    });
    return () => { alive = false; sub.remove(); };
  }, [target, check]);

  const start = useCallback(async ({ amount, method }) => {
    if (starting) return false;
    setStarting(true);
    try {
      const res = await api[target].initiate({ amount, method });
      const { transactionId, paymentUrl } = res.data || {};
      if (!transactionId || !paymentUrl) throw new Error('Could not start the payment.');
      const p = { id: transactionId, target };
      pendingRef.current = p;
      try { await AsyncStorage.setItem(pendingKey(target), JSON.stringify(p)); } catch { /* ignore */ }
      await Linking.openURL(paymentUrl);
      return true;
    } catch (e) {
      Alert.alert('Could not start payment', e?.message || 'Please try again.');
      return false;
    } finally {
      setStarting(false);
    }
  }, [target, starting]);

  return { start, starting, checking, checkNow: check };
}

// eSewa / Khalti picker. Disabled gateways stay visible but greyed out.
export function PaymentMethodPicker({ methods, value, onChange }) {
  if (!methods) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;
  return (
    <View style={styles.row}>
      {methods.map((m) => {
        const active = value === m.id;
        return (
          <Pressable
            key={m.id}
            disabled={!m.enabled}
            onPress={() => onChange(m.id)}
            style={[styles.tile, active && styles.tileActive, !m.enabled && styles.tileDisabled]}
          >
            <PaymentLogo id={m.id} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{m.label}</Text>
              {!m.enabled ? <Text style={styles.sub}>Unavailable</Text> : null}
            </View>
            <View style={[styles.radio, active && styles.radioOn]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, marginBottom: 12 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileActive: { borderColor: colors.primary, borderWidth: 1.5 },
  tileDisabled: { opacity: 0.45 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
