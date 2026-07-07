import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { bidApi } from '../../api/trip.api';
import { userApi } from '../../api/user.api';
import { Button, Chip, FormField, Sheet } from '../../components/ui';
import { colors, radius, shadow, spacing, STATUS_TOP_PAD, type } from '../../theme';

function money(n) {
  return `NPR ${Number(n || 0).toLocaleString()}`;
}

const MIN_WITHDRAWAL = 100;

const BID_STATUS_COLOR = {
  accepted: colors.primary,
  pending: colors.warn,
  rejected: colors.danger,
  expired: colors.textFaint,
};

const WITHDRAWAL_STATUS_COLOR = {
  pending: colors.warn,
  approved: colors.primary,
  paid: colors.success || colors.primary,
  rejected: colors.danger,
};

const METHODS = [
  { key: 'bank', label: 'Bank' },
  { key: 'khalti', label: 'Khalti' },
  { key: 'esewa', label: 'eSewa' },
];

export default function DriverEarnings() {
  const [stats, setStats] = useState(null);
  const [bids, setBids] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cashout form
  const [showCashout, setShowCashout] = useState(false);
  const [method, setMethod] = useState('bank');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [walletId, setWalletId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [earnRes, bidRes, wRes] = await Promise.all([
        userApi.getMyEarnings(),
        bidApi.getMyBids({ limit: 20 }),
        userApi.getMyWithdrawals(),
      ]);
      setStats(earnRes.data);
      setBids(bidRes.data?.bids || []);
      setWithdrawals(wRes.data || []);
    } catch {
      // leave previous data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const balance = Number(stats?.walletBalance || 0);

  const resetForm = () => {
    setAmount(''); setBankName(''); setAccountName(''); setAccountNumber(''); setWalletId('');
    setMethod('bank');
  };

  const submitCashout = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed < MIN_WITHDRAWAL) {
      Alert.alert('Invalid amount', `Minimum withdrawal is ${money(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (parsed > balance) {
      Alert.alert('Insufficient balance', 'You cannot withdraw more than your available balance.');
      return;
    }
    if (method === 'bank' && (!bankName || !accountName || !accountNumber)) {
      Alert.alert('Missing details', 'Please fill in your bank name, account name and account number.');
      return;
    }
    if (method !== 'bank' && !walletId) {
      Alert.alert('Missing details', `Please enter your ${method === 'khalti' ? 'Khalti' : 'eSewa'} ID / phone number.`);
      return;
    }

    setSubmitting(true);
    try {
      const destination = method === 'bank'
        ? { bankName, accountName, accountNumber }
        : { walletId };
      await userApi.requestWithdrawal({ amount: parsed, method, destination });
      setShowCashout(false);
      resetForm();
      Alert.alert('Request sent', 'Your withdrawal request has been submitted for approval.');
      load();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not submit withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total earnings</Text>
          <Text style={styles.heroValue}>{money(stats?.earnings)}</Text>
        </View>

        {/* Available balance + cash out */}
        <View style={styles.balanceCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>Available to withdraw</Text>
            <Text style={styles.balanceValue}>{money(balance)}</Text>
          </View>
          <Button
            label="Cash out"
            size="sm"
            onPress={() => setShowCashout(true)}
            disabled={balance < MIN_WITHDRAWAL}
          />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.totalRides ?? 0}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {stats?.totalRatings ? Number(stats.rating).toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.cancelledRides ?? 0}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Withdrawals</Text>
            {withdrawals.map((w) => (
              <View key={w._id} style={styles.bidRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bidRoute}>{money(w.amount)} · {w.method}</Text>
                  <Text style={styles.bidMeta}>{new Date(w.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.bidStatus, { color: WITHDRAWAL_STATUS_COLOR[w.status] || colors.textMuted }]}>
                  {w.status}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Recent bids</Text>
        {bids.length === 0 ? (
          <Text style={styles.empty}>No bids yet. Go online and start bidding on trips.</Text>
        ) : (
          bids.map((b) => (
            <View key={b._id} style={styles.bidRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bidRoute} numberOfLines={1}>
                  {b.tripId?.pickup?.address || 'Trip'} → {b.tripId?.dropoff?.address || ''}
                </Text>
                <Text style={styles.bidMeta}>{money(b.amount)}</Text>
              </View>
              <Text style={[styles.bidStatus, { color: BID_STATUS_COLOR[b.status] || colors.textMuted }]}>
                {b.status}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Cashout sheet */}
      <Modal visible={showCashout} transparent animationType="slide" onRequestClose={() => setShowCashout(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCashout(false)} />
        <View style={styles.sheetWrap}>
          <Sheet tall>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Cash out</Text>
              <Text style={styles.sheetSub}>Available: {money(balance)}</Text>

              <Text style={styles.fieldLabel}>Method</Text>
              <View style={styles.methodRow}>
                {METHODS.map((m) => (
                  <Chip key={m.key} label={m.label} active={method === m.key} onPress={() => setMethod(m.key)} />
                ))}
              </View>

              <View style={{ height: spacing.md }} />

              <FormField
                label="Amount (NPR)"
                value={amount}
                onChangeText={setAmount}
                placeholder={`Min ${MIN_WITHDRAWAL}`}
                keyboardType="numeric"
              />

              {method === 'bank' ? (
                <>
                  <FormField label="Bank name" value={bankName} onChangeText={setBankName} placeholder="e.g. Nabil Bank" />
                  <FormField label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Account holder name" />
                  <FormField label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" keyboardType="numeric" />
                </>
              ) : (
                <FormField
                  label={`${method === 'khalti' ? 'Khalti' : 'eSewa'} ID / phone`}
                  value={walletId}
                  onChangeText={setWalletId}
                  placeholder="98XXXXXXXX"
                  keyboardType="phone-pad"
                />
              )}

              <View style={{ height: spacing.sm }} />
              <Button
                label={submitting ? 'Submitting…' : 'Request withdrawal'}
                onPress={submitCashout}
                disabled={submitting}
              />
              <View style={{ height: spacing.sm }} />
              <Button label="Cancel" variant="ghost" onPress={() => setShowCashout(false)} />
            </ScrollView>
          </Sheet>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, paddingTop: STATUS_TOP_PAD, paddingBottom: spacing.xxl },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.lg },

  heroCard: {
    backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl,
    ...shadow.card,
  },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.8)' },
  heroValue: { ...type.h1, color: '#fff', marginTop: 4 },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md,
  },
  balanceLabel: { ...type.caption, color: colors.textMuted },
  balanceValue: { ...type.h2, color: colors.text, marginTop: 2 },

  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  statBox: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center',
  },
  statValue: { ...type.h2, color: colors.text },
  statLabel: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  sectionTitle: { ...type.bodyBold, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { ...type.body, color: colors.textMuted },

  bidRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm,
  },
  bidRoute: { ...type.body, color: colors.text },
  bidMeta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  bidStatus: { ...type.caption, fontWeight: '800', textTransform: 'capitalize' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetSub: { ...type.caption, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  fieldLabel: { ...type.eyebrow, color: colors.textMuted, marginBottom: 6 },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
});
