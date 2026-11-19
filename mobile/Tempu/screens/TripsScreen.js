import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RefreshControl from '../components/RefreshControl';
import { VehiclePhoto } from '../components/Brand';
import { ChevronIcon, ReceiptIcon, StarIcon } from '../components/Icons';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_LABELS = {
  cash: 'Cash',
  esewa: 'eSewa',
  khalti: 'Khalti',
  wallet: 'Wallet',
};

const VEHICLE_LABELS = {
  scooter: 'Scooter',
  bike: 'Bike',
  tuktuk: 'Tempu',
  tuktuk_delivery: 'Delivery',
  comfort: 'Comfort',
};

// What a trip's status means to the rider, and how it is coloured:
// ok = done, bad = didn't happen, live = still in progress.
function statusInfo(t) {
  switch (t.status) {
    case 'completed': return { label: 'Completed', tone: 'ok' };
    case 'cancelled':
      if (t.cancelledBy === 'system') return { label: 'No driver found', tone: 'bad' };
      if (t.cancelledBy === 'driver') return { label: 'Driver cancelled', tone: 'bad' };
      return { label: 'Cancelled', tone: 'bad' };
    case 'pending': return { label: 'Finding a driver', tone: 'live' };
    case 'accepted': return { label: 'Driver assigned', tone: 'live' };
    case 'arriving': return { label: 'Driver on the way', tone: 'live' };
    case 'started': return { label: 'On the trip', tone: 'live' };
    default: return { label: t.status || '-', tone: 'live' };
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TripsScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  // Paging + server totals: the list used to be page 1 only (20 trips) and
  // the chip counts were counts of that page.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);

  const statusParam = filter === 'all' ? undefined : filter;

  const loadTrips = useCallback(async () => {
    try {
      setError('');
      const res = await userApi.getTripHistory(1, { status: statusParam });
      setTrips(res.data?.trips || []);
      setTotal(res.data?.pagination?.total ?? 0);
      setCounts(res.data?.counts || {});
      setPage(1);
    } catch (err) {
      setError(err.message || 'Could not load trips.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusParam]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const loadMore = async () => {
    if (loadingMore || trips.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await userApi.getTripHistory(page + 1, { status: statusParam });
      const more = res.data?.trips || [];
      setTrips((prev) => {
        const seen = new Set(prev.map((t) => t._id));
        return [...prev, ...more.filter((t) => !seen.has(t._id))];
      });
      setPage(page + 1);
      setTotal(res.data?.pagination?.total ?? total);
    } catch {
      // keep the button so they can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const filtered = trips;

  const countBy = (id) => {
    if (id === 'all') return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[id] || 0;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>History</Text>
          <Text style={styles.headerSubtitle}>
            {total} {total === 1 ? 'trip' : 'trips'}
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <Pressable
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
              <View style={[styles.filterCount, active && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                  {countBy(f.id)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <ReceiptIcon size={22} color={colors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No trips yet' : `No ${filter} trips`}
            </Text>
            <Text style={styles.emptySub}>Your ride history will appear here.</Text>
          </View>
        ) : (
          <View style={styles.listBox}>
          {filtered.map((t, idx) => {
            const open = openId === t._id;
            const info = statusInfo(t);
            const tone = info.tone;
            return (
              <Pressable
                key={t._id}
                style={({ pressed }) => [styles.card, idx === filtered.length - 1 && styles.cardLast, pressed && styles.cardPressed]}
                onPress={() => setOpenId(open ? null : t._id)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <VehiclePhoto type={t.vehicleType} size={34} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitleSmall} numberOfLines={1}>
                      {t.dropoff?.address || '-'}
                    </Text>
                    <Text style={styles.compactMeta} numberOfLines={1}>
                      {formatDateTime(t.createdAt)} ·{' '}
                      <Text style={tone === 'bad' ? styles.toneBad : tone === 'live' ? styles.toneLive : styles.toneOk}>
                        {info.label}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.cardRightCompact}>
                    <Text style={styles.cardPriceSmall}>
                      Rs {t.finalPrice ?? t.offeredPrice}
                    </Text>
                    <ChevronIcon dir={open ? 'up' : 'down'} size={14} />
                  </View>
                </View>

                {open && (
                  <View style={styles.expandedRoute}>
                    <View style={styles.routeLine}>
                      <View style={styles.routePickupDot} />
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {t.pickup?.address || '-'}
                      </Text>
                    </View>
                    <View style={styles.routeLine}>
                      <View style={styles.routeDestSquare} />
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {t.dropoff?.address || '-'}
                      </Text>
                    </View>
                  </View>
                )}

                {open && (
                  <View style={styles.cardDetails}>
                    <DetailRow label="Vehicle" value={VEHICLE_LABELS[t.vehicleType] || t.vehicleType} />
                    <DetailRow label="Payment" value={`${PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod} · ${t.paymentStatus}`} />
                    {t.driverId && (
                      <DetailRow
                        label="Driver"
                        value={`${t.driverId.userId?.name || 'Driver'} · ${t.driverId.vehiclePlate || ''}`}
                      />
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
          </View>
        )}
        {!error && trips.length < total ? (
          <Pressable style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
            {loadingMore
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.loadMoreText}>Load more</Text>}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 16,
    paddingBottom: 14,
  },
  headerTitle: { color: colors.text, fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.6 },
  headerSubtitle: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body, marginTop: 2, letterSpacing: -0.1 },
  countPill: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyBold },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: -0.2 },
  filterTextActive: { color: '#ffffff' },
  filterCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  filterCountText: { color: colors.text, fontSize: 12, fontFamily: fonts.bodyBold },
  filterCountTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 20, paddingBottom: 28 },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 36, fontSize: 14, fontFamily: fonts.body },

  emptyWrap: { alignItems: 'center', marginTop: 64, paddingHorizontal: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bodyBold, letterSpacing: -0.2 },
  emptySub: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body, marginTop: 4, textAlign: 'center' },

  // One bordered list, rows split by dividers (was a rounded card per trip).
  listBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cardLast: { borderBottomWidth: 0 },
  toneOk: { color: colors.success, fontFamily: fonts.bodySemibold },
  toneBad: { color: colors.danger, fontFamily: fonts.bodySemibold },
  toneLive: { color: colors.warn, fontFamily: fonts.bodySemibold },
  cardPressed: { opacity: 0.85, backgroundColor: colors.surfaceMuted },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardTitleSmall: { color: colors.text, fontSize: 15, fontFamily: fonts.bodyBold, letterSpacing: -0.2 },
  compactMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  compactMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginTop: 3 },
  cardRightCompact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardPriceSmall: { color: colors.text, fontSize: 15, fontFamily: fonts.bodyBold },
  rightBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 96,
  },
  typePillOk: { backgroundColor: colors.primarySoft },
  typePillCancelled: { backgroundColor: colors.dangerSoft },
  typePillLive: { backgroundColor: colors.warnSoft },
  typePillTextLive: { color: colors.warn },
  typePillText: { fontSize: 11, fontFamily: fonts.bodyBold, letterSpacing: -0.1 },
  typePillTextOk: { color: colors.primary },
  typePillTextCancelled: { color: colors.danger },

  expandedRoute: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 4,
  },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  routePickupDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  routeDestSquare: { width: 6, height: 6, borderRadius: 1, backgroundColor: colors.text },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotOk: { backgroundColor: colors.primary },
  statusDotCancelled: { backgroundColor: colors.danger },
  statusDotLive: { backgroundColor: colors.warn },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusOk: { backgroundColor: colors.primarySoft },
  statusCancelled: { backgroundColor: colors.dangerSoft },
  statusLive: { backgroundColor: colors.warnSoft },
  statusTextLive: { color: colors.warn },
  loadMore: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  loadMoreText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyBold },
  statusText: { fontSize: 11, fontFamily: fonts.bodyBold, textTransform: 'capitalize' },
  statusTextOk: { color: colors.primaryDark },
  statusTextCancelled: { color: colors.danger },
  cardMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginTop: 4 },

  cardDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  detailValue: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemibold, maxWidth: '60%' },

  ghostBtn: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyBold },
});
