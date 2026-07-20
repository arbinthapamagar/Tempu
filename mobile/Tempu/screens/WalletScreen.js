import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PaymentLogo } from '../components/Brand';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from '../components/Icons';
import { userApi } from '../api/user.api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { radius, spacing, type, shadow } from '../theme';

const PAYMENT_LABELS = {
  cash: 'Cash',
  esewa: 'eSewa',
  khalti: 'Khalti',
  wallet: 'Wallet',
};

const TYPE_LABELS = {
  trip_payment: 'Trip payment',
  trip_earning: 'Trip earning',
  subscription_payment: 'Subscription',
  wallet_topup: 'Wallet top up',
  wallet_withdrawal: 'Withdrawal',
  platform_fee: 'Platform fee',
  refund: 'Refund',
};

function formatDate(value) {
  const d = new Date(value);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        userApi.getWallet(),
        userApi.getTransactions(),
      ]);
      setWalletBalance(walletRes.data?.walletBalance ?? 0);
      setTransactions(txRes.data?.transactions || txRes.data || []);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const preferredMethod = user?.preferredPaymentMethod || 'cash';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
        <Text style={styles.headerSub}>Manage your balance & payments</Text>
      </View>

      <View style={styles.balanceCard}>
        <View style={styles.balanceDecor} />
        <View style={styles.balanceDecorSmall} />
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>Rs {walletBalance.toLocaleString()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        <View style={styles.methodList}>
          {Object.entries(PAYMENT_LABELS).map(([id, label]) => {
            const preferred = preferredMethod === id;
            return (
              <View key={id} style={styles.methodRow}>
                <PaymentLogo id={id} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{label}</Text>
                  <Text style={styles.methodSub}>
                    {preferred ? 'Preferred method' : 'Tap to set as preferred'}
                  </Text>
                </View>
                {preferred && (
                  <View style={styles.preferredPill}>
                    <CheckIcon size={12} color={colors.primaryDark} />
                    <Text style={styles.preferredText}>Default</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.length > 0 && (
            <Pressable onPress={onRefresh} hitSlop={8}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          )}
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : transactions.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
          <View style={styles.txList}>
            {transactions.map((t, i) => {
              const positive = t.amount > 0;
              return (
                <View
                  key={t._id}
                  style={[styles.txRow, i === transactions.length - 1 && styles.txRowLast]}
                >
                  <View style={[styles.txIcon, positive ? styles.txIconPos : styles.txIconNeg]}>
                    {positive ? (
                      <ArrowDownIcon size={16} color={colors.success} />
                    ) : (
                      <ArrowUpIcon size={16} color={colors.danger} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{t.note || TYPE_LABELS[t.type] || t.type}</Text>
                    <Text style={styles.txMeta}>
                      {TYPE_LABELS[t.type]} · {PAYMENT_LABELS[t.method] || t.method}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, positive ? styles.txPos : styles.txNeg]}>
                      {positive ? '+' : ''}Rs {Math.abs(t.amount)}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(t.createdAt)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxxl + spacing.sm },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.md },
  headerTitle: { ...type.display, color: colors.text },
  headerSub: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },

  // ── Balance card ──────────────────────────────────────────────
  balanceCard: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    ...shadow.fab,
  },
  balanceDecor: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  balanceDecorSmall: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  balanceLabel: {
    ...type.eyebrow,
    color: 'rgba(255,255,255,0.85)',
  },
  balanceAmount: {
    ...type.display,
    fontSize: 40,
    color: '#fff',
    marginTop: spacing.sm,
    letterSpacing: -1,
  },
  balanceActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  balanceBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBtnPrimaryText: { ...type.bodyBold, color: colors.primaryDark },
  balanceBtnGhost: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBtnGhostText: { ...type.bodyBold, color: '#fff' },

  // ── Sections ──────────────────────────────────────────────────
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...type.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
  viewAll: { ...type.caption, color: colors.primary, marginBottom: spacing.md },

  // ── Quick top up ──────────────────────────────────────────────
  topupGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  topupChip: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  topupChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  topupChipText: { ...type.bodyBold, color: colors.text },
  topupChipTextActive: { color: colors.primary },

  cta: {
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  ctaText: { ...type.bodyBold, fontSize: 15, color: '#fff' },

  // ── Payment methods ───────────────────────────────────────────
  methodList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  methodLabel: { ...type.bodyBold, color: colors.text },
  methodSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  preferredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  preferredText: { ...type.micro, color: colors.primary },

  // ── Transactions ──────────────────────────────────────────────
  txList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  txRowLast: { borderBottomWidth: 0 },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconPos: { backgroundColor: 'rgba(74,222,128,0.12)' },
  txIconNeg: { backgroundColor: 'rgba(248,113,113,0.12)' },
  txTitle: { ...type.bodyBold, color: colors.text },
  txMeta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { ...type.bodyBold, fontSize: 15 },
  txPos: { color: colors.success },
  txNeg: { color: colors.danger },
  txDate: { ...type.micro, color: colors.textFaint, marginTop: 2 },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
