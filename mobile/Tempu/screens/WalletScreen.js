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
import { ArrowDownIcon, ArrowUpIcon } from '../components/Icons';
import { userApi } from '../api/user.api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { spacing, type } from '../theme';

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
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceAmount}>Rs {Number(walletBalance || 0).toLocaleString()}</Text>
          </View>
          {onTopup ? (
            <Pressable style={styles.balanceBtnPrimary} onPress={onTopup}>
              <Text style={styles.balanceBtnPrimaryText}>Top up</Text>
            </Pressable>
          ) : null}
        </View>
        {onTopup ? <Text style={styles.balanceHint}>Top up with eSewa or Khalti.</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>
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
  // Plain bordered row: balance on the left, action on the right.
  balanceCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },


  balanceLabel: { ...type.small, color: colors.textMuted },
  balanceAmount: { ...type.h1, fontSize: 26, color: colors.text, marginTop: 2 },
  balanceHint: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.xl, marginTop: spacing.sm },
  balanceBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBtnPrimaryText: { ...type.bodyBold, color: '#ffffff' },

  // ── Sections ──────────────────────────────────────────────────
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  sectionTitle: { ...type.h3, color: colors.text, marginBottom: spacing.sm },


  // ── Transactions ──────────────────────────────────────────────
  txList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconPos: {},
  txIconNeg: {},
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
  loadMore: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  loadMoreText: { ...type.bodyBold, color: colors.text },
});
