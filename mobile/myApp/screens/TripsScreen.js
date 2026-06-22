import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VehiclePhoto } from '../components/Brand';
import { ChevronIcon, ReceiptIcon, StarIcon } from '../components/Icons';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';

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
  tuktuk: 'Rickshaw',
  tuktuk_delivery: 'Delivery',
  taxi: 'Taxi',
  comfort: 'Comfort',
};

function formatDateTime(value) {
  if (!value) return '—';
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

  const loadTrips = useCallback(async () => {
    try {
      setError('');
      const res = await userApi.getTripHistory();
      setTrips(res.data?.trips || res.data || []);
    } catch (err) {
      setError(err.message || 'Could not load trips.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const filtered = trips.filter((t) => filter === 'all' || t.status === filter);

  const countBy = (id) => {
    if (id === 'all') return trips.length;
    return trips.filter((t) => t.status === id).length;
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
            {filtered.length} {filtered.length === 1 ? 'trip' : 'trips'} · your past rides
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{filtered.length}</Text>
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
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySub}>Your ride history will appear here.</Text>
          </View>
        ) : (
          filtered.map((t) => {
            const open = openId === t._id;
            const isCancelled = t.status === 'cancelled';
            return (
              <Pressable
                key={t._id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => setOpenId(open ? null : t._id)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <VehiclePhoto type={t.vehicleType} size={34} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitleSmall} numberOfLines={1}>
                      {t.dropoff?.address || '—'}
                    </Text>
                    <View style={styles.compactMetaRow}>
                      <View
                        style={[
                          styles.statusDotSmall,
                          isCancelled ? styles.statusDotCancelled : styles.statusDotOk,
                        ]}
                      />
                      <Text style={styles.compactMeta} numberOfLines={1}>
                        {formatDateTime(t.createdAt)} · {VEHICLE_LABELS[t.vehicleType]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRightCompact}>
                    <Text style={styles.cardPriceSmall}>
                      Rs {t.finalPrice ?? t.offeredPrice}
                    </Text>
                    <View style={styles.rightBottomRow}>
                      <View
                        style={[
                          styles.typePill,
                          isCancelled ? styles.typePillCancelled : styles.typePillOk,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            isCancelled ? styles.typePillTextCancelled : styles.typePillTextOk,
                          ]}
                          numberOfLines={1}
                        >
                          {VEHICLE_LABELS[t.vehicleType] || t.vehicleType}
                        </Text>
                      </View>
                      <ChevronIcon dir={open ? 'up' : 'down'} size={14} />
                    </View>
                  </View>
                </View>

                {open && (
                  <View style={styles.expandedRoute}>
                    <View style={styles.routeLine}>
                      <View style={styles.routePickupDot} />
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {t.pickup?.address || '—'}
                      </Text>
                    </View>
                    <View style={styles.routeLine}>
                      <View style={styles.routeDestSquare} />
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {t.dropoff?.address || '—'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        isCancelled ? styles.statusCancelled : styles.statusOk,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isCancelled ? styles.statusDotCancelled : styles.statusDotOk,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          isCancelled ? styles.statusTextCancelled : styles.statusTextOk,
                        ]}
                      >
                        {t.status}
                      </Text>
                    </View>
                  </View>
                )}

                {open && (
                  <View style={styles.cardDetails}>
                    <DetailRow label="Payment" value={`${PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod} · ${t.paymentStatus}`} />
                    {t.driverId && (
                      <DetailRow
                        label="Driver"
                        value={`${t.driverId.userId?.name || 'Driver'} · ${t.driverId.vehiclePlate || ''}`}
                      />
                    )}
                    {t.status === 'completed' && (
                      <Pressable style={styles.ghostBtn}>
                        <ReceiptIcon size={14} color={colors.text} />
                        <Text style={styles.ghostBtnText}>Get receipt</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })
        )}
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
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  headerSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2, letterSpacing: -0.1 },
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
  countPillText: { color: colors.text, fontSize: 13, fontWeight: '800' },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
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
  filterCountText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  filterCountTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 20, paddingBottom: 28 },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 36, fontSize: 14 },

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
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  emptySub: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.85, backgroundColor: colors.surfaceMuted },
  cardTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardTitleSmall: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  compactMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  compactMeta: { color: colors.textMuted, fontSize: 12, flex: 1 },
  cardRightCompact: { alignItems: 'flex-end', gap: 6 },
  cardPriceSmall: { color: colors.primary, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  rightBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 96,
  },
  typePillOk: { backgroundColor: colors.primarySoft },
  typePillCancelled: { backgroundColor: colors.dangerSoft },
  typePillText: { fontSize: 11, fontWeight: '700', letterSpacing: -0.1 },
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
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statusTextOk: { color: colors.primaryDark },
  statusTextCancelled: { color: colors.danger },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  cardDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: colors.textMuted, fontSize: 13 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: '60%' },

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
  ghostBtnText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
