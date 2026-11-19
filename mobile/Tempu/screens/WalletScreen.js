import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RefreshControl from '../components/RefreshControl';
import { ScreenHeader } from '../components/ui';
import { PaymentLogo } from '../components/Brand';
import { ArrowDownIcon, ArrowUpIcon } from '../components/Icons';
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

const DEBIT_TYPES = new Set([
  'trip_payment',
  'subscription_payment',
  'wallet_withdrawal',
  'platform_fee',
]);

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

// Rider wallet: balance, top-up (through eSewa / Khalti, settled by the
// backend) and the full transaction history, including top-ups that are still
// being confirmed or did not go through.
export default function WalletScreen({ onBack, onTopup, refreshKey = 0, underAppBar = false }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        userApi.getWallet(),
        userApi.getTransactions(1),
      ]);
      setWalletBalance(walletRes.data?.walletBalance ?? 0);
      setTransactions(txRes.data?.transactions || []);
      setPage(1);
      setPages(txRes.data?.pagination?.pages || 1);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload on mount and whenever a top-up settles (refreshKey bumps).
  useEffect(() => { load(); }, [load, refreshKey]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const res = await userApi.getTransactions(page + 1);
      const more = res.data?.transactions || [];
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => t._id));
        return [...prev, ...more.filter((t) => !seen.has(t._id))];
      });
      setPage(page + 1);
      setPages(res.data?.pagination?.pages || pages);
    } catch {
      // leave the button so they can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        style={underAppBar ? { paddingTop: spacing.md } : undefined}
        title="Wallet"
        left={onBack ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceDecor} />
          <View style={styles.balanceDecorSmall} />
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>Rs {Number(walletBalance || 0).toLocaleString()}</Text>
          {onTopup ? (
            <View style={styles.balanceActions}>
              <Pressable style={styles.balanceBtnPrimary} onPress={onTopup}>
                <Text style={styles.balanceBtnPrimaryText}>Top up</Text>
              </Pressable>
              <View style={styles.gatewayRow}>
                <PaymentLogo id="esewa" size={22} />
                <PaymentLogo id="khalti" size={22} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : transactions.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
          ) : (
            <View style={styles.txList}>
              {transactions.map((t, i) => {
                const pending = t.status === 'pending';
                const failed = t.status === 'failed' || t.status === 'refunded';
                // The backend stores every amount as positive; direction comes
                // from the type (a paid ride is money out, not "+Rs").
                const positive = DEBIT_TYPES.has(t.type) ? false : t.amount > 0;
                const settled = !pending && !failed;
                return (
                  <View
                    key={t._id}
                    style={[styles.txRow, i === transactions.length - 1 && styles.txRowLast]}
                  >
                    <View style={[styles.txIcon, settled && (positive ? styles.txIconPos : styles.txIconNeg)]}>
                      {pending ? (
                        <Ionicons name="time-outline" size={16} color={colors.warn} />
                      ) : failed ? (
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                      ) : positive ? (
                        <ArrowDownIcon size={16} color={colors.success} />
                      ) : (
                        <ArrowUpIcon size={16} color={colors.danger} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle} numberOfLines={1}>{t.note || TYPE_LABELS[t.type] || t.type}</Text>
                      {/* the title already names the type — just say how it was paid */}
                      <Text style={styles.txMeta} numberOfLines={1}>
                        {PAYMENT_LABELS[t.method] || t.method}
                      </Text>
                      {pending ? (
                        <Text style={[styles.txState, styles.txStatePending]}>Confirming payment…</Text>
                      ) : failed ? (
                        <Text style={[styles.txState, styles.txStateFailed]}>
                          {t.status === 'refunded' ? 'Refunded' : 'Failed · not charged'}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.txRight}>
                      <Text
                        style={[
                          styles.txAmount,
                          settled ? (positive ? styles.txPos : styles.txNeg) : styles.txMuted,
                          failed && styles.txStruck,
                        ]}
                      >
                        {settled ? (positive ? '+' : '−') : ''}Rs {Math.abs(t.amount).toLocaleString()}
                      </Text>
                      <Text style={styles.txDate}>{formatDate(t.createdAt)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {!loading && page < pages ? (
            <Pressable style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
              {loadingMore
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.loadMoreText}>Load more</Text>}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
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
  balanceActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
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
  txMuted: { color: colors.textMuted },
  txStruck: { textDecorationLine: 'line-through' },
  txState: { ...type.caption, marginTop: 4 },
  txStatePending: { color: colors.warn },
  txStateFailed: { color: colors.textMuted },
  gatewayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' },
  loadMore: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  loadMoreText: { ...type.bodyBold, color: colors.text },
});
