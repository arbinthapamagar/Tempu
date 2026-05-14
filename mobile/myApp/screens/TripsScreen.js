import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VehiclePhoto } from '../components/Brand';
import { ChevronIcon, ReceiptIcon, StarIcon } from '../components/Icons';
import { TRIPS } from '../data/mockData';
import { colors } from '../theme/colors';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function countBy(id) {
  if (id === 'all') return TRIPS.length;
  return TRIPS.filter((t) => t.status === id).length;
}

const PAYMENT_LABELS = {
  cash: 'Cash',
  esewa: 'eSewa',
  khalti: 'Khalti',
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
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const trips = TRIPS.filter((t) => filter === 'all' || t.status === filter);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Trips</Text>
        <View style={styles.headerSide}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{trips.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = f.id === filter;
          const count = countBy(f.id);
          return (
            <Pressable
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {f.label}
              </Text>
              <View
                style={[
                  styles.filterCount,
                  active && styles.filterCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    active && styles.filterCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {trips.length === 0 && (
          <Text style={styles.empty}>No trips in this filter.</Text>
        )}
        {trips.map((t) => {
          const open = openId === t._id;
          const isCancelled = t.status === 'cancelled';
          return (
            <Pressable
              key={t._id}
              style={styles.card}
              onPress={() => setOpenId(open ? null : t._id)}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <VehiclePhoto type={t.vehicleType} size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitleSmall} numberOfLines={1}>
                    {t.dropoff.address}
                  </Text>
                  <View style={styles.compactMetaRow}>
                    <View
                      style={[
                        styles.statusDotSmall,
                        isCancelled
                          ? styles.statusDotCancelled
                          : styles.statusDotOk,
                      ]}
                    />
                    <Text style={styles.compactMeta}>
                      {formatDateTime(t.createdAt)} ·{' '}
                      {VEHICLE_LABELS[t.vehicleType]}
                    </Text>
                  </View>
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
                      {t.pickup.address}
                    </Text>
                  </View>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDestSquare} />
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {t.dropoff.address}
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
                        isCancelled
                          ? styles.statusDotCancelled
                          : styles.statusDotOk,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        isCancelled
                          ? styles.statusTextCancelled
                          : styles.statusTextOk,
                      ]}
                    >
                      {t.status}
                    </Text>
                  </View>
                </View>
              )}

              {open && (
                <View style={styles.cardDetails}>
                  <DetailRow
                    label="Distance"
                    value={t.distance ? `${t.distance} km` : '—'}
                  />
                  <DetailRow
                    label="Duration"
                    value={t.duration ? `${t.duration} min` : '—'}
                  />
                  <DetailRow
                    label="Payment"
                    value={`${PAYMENT_LABELS[t.paymentMethod]} · ${t.paymentStatus}`}
                  />
                  {t.driver && (
                    <DetailRow
                      label="Driver"
                      value={`${t.driver.name} · ${t.driver.vehiclePlate}`}
                    />
                  )}
                  {t.status === 'completed' && !t.isRatedByRider && (
                    <Pressable style={styles.rateBtn}>
                      <StarIcon size={14} color="#ffffff" />
                      <Text style={styles.rateBtnText}>Rate your trip</Text>
                    </Pressable>
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
        })}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 12,
    paddingBottom: 12,
  },
  headerSide: {
    minWidth: 40,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countPill: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
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
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterTextActive: { color: '#ffffff' },
  filterCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  filterCountText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  filterCountTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 20, paddingBottom: 28 },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 36,
    fontSize: 14,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleSmall: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  compactMeta: { color: colors.textMuted, fontSize: 11, flex: 1 },
  cardRightCompact: { alignItems: 'flex-end', gap: 3 },
  cardPriceSmall: { color: colors.text, fontSize: 14, fontWeight: '800' },
  expandedRoute: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardChev: { paddingTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotOk: { backgroundColor: colors.primary },
  statusDotCancelled: { backgroundColor: colors.danger },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  routePickupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  routeDestSquare: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  cardDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardPrice: { color: colors.text, fontSize: 16, fontWeight: '800' },
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

  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: { color: colors.textMuted, fontSize: 13 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '600', maxWidth: '60%' },

  rateBtn: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
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
