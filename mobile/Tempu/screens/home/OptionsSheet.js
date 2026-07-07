import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlagIcon, PinIcon } from '../../components/Icons';
import { Sheet } from '../../components/ui';
import { VEHICLE_TYPES } from './useRideFlow';
import { colors } from '../../theme';
import { fonts } from '../../theme/type';

const MIN_FARE = 50;
const FARE_STEP = 20;

const VEHICLE_ICON = {
  tuktuk: 'rickshaw',
  scooter: 'moped',
  taxi: 'taxi',
  tuktuk_delivery: 'package-variant-closed',
};

export default function OptionsSheet({
  pickup,
  destination,
  vehicleId,
  setVehicleId,
  offeredPrice,
  setOfferedPrice,
  standardFare = null,
  onConfirm,
  loading = false,
}) {
  const vehicle = VEHICLE_TYPES.find((v) => v.id === vehicleId);
  const suggested = vehicle?.baseFare ?? 0;
  const floor = standardFare && standardFare > 0 ? standardFare : MIN_FARE;
  const priceNum = Number(offeredPrice) || 0;
  const pickupReady = !!pickup && pickup.trim().length > 0;
  const destReady = !!destination && destination.trim().length > 0;
  const canConfirm = priceNum >= floor && pickupReady && destReady;

  // Once the standard fare is known, never let the offer sit below it.
  useEffect(() => {
    if (standardFare && priceNum < standardFare) {
      setOfferedPrice(String(standardFare));
    }
  }, [standardFare]);

  const selectVehicle = (id, baseFare) => {
    setVehicleId(id);
    setOfferedPrice(String(Math.max(baseFare, floor)));
  };

  return (
    <Sheet tall>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose ride</Text>
          {vehicle?.eta != null && (
            <View style={styles.avgChip}>
              <Text style={styles.avgChipText}>{vehicle.eta} min avg.</Text>
            </View>
          )}
        </View>

        {/* Route strip */}
        <View style={styles.routeStrip}>
          <PinIcon size={11} color={colors.primary} />
          <Text
            style={[styles.routeText, !pickupReady && styles.routeTextMissing]}
            numberOfLines={1}
          >
            {pickupReady ? pickup : 'Set pickup location'}
          </Text>
          <Text style={styles.routeArrow}>→</Text>
          <FlagIcon size={11} color={colors.text} />
          <Text style={styles.routeText} numberOfLines={1}>
            {destination}
          </Text>
        </View>

        {!pickupReady && (
          <Text style={styles.warn}>
            Pickup not detected — set it from the search screen to continue.
          </Text>
        )}

        {/* Vehicle list */}
        <View style={styles.rideList}>
          {VEHICLE_TYPES.map((r, i) => {
            const selected = r.id === vehicleId;
            const current = Number(offeredPrice) || r.baseFare;
            const bump = (delta) =>
              setOfferedPrice(String(Math.max(floor, current + delta)));
            const iconName = VEHICLE_ICON[r.id] || 'car';
            return (
              <View
                key={r.id}
                style={[styles.rideCard, selected && styles.rideCardSelected]}
              >
                <Pressable
                  onPress={() => selectVehicle(r.id, r.baseFare)}
                  style={styles.rideRow}
                >
                  <View
                    style={[styles.rideArt, selected && styles.rideArtSelected]}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={30}
                      color={selected ? '#ffffff' : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rideName, selected && styles.textOnDark]}>
                      {r.name}
                    </Text>
                    <Text
                      style={[styles.rideNote, selected && styles.subOnDark]}
                      numberOfLines={1}
                    >
                      {r.eta} min away • {r.note}
                    </Text>
                  </View>
                  <View style={styles.rideRight}>
                    <Text style={[styles.ridePrice, selected && styles.textOnDark]}>
                      Rs {selected ? current : r.baseFare}
                    </Text>
                    {i === 0 && (
                      <Text
                        style={[styles.recommended, selected && styles.recommendedOnDark]}
                      >
                        RECOMMENDED
                      </Text>
                    )}
                  </View>
                </Pressable>

                {selected && (
                  <View style={styles.fareAdjust}>
                    <Pressable style={styles.fareBtn} onPress={() => bump(-FARE_STEP)} hitSlop={4}>
                      <Ionicons name="remove" size={20} color="#ffffff" />
                    </Pressable>
                    <View style={styles.fareCenter}>
                      <Text style={styles.fareLabel}>YOUR OFFER</Text>
                      <Text style={styles.fareValue}>Rs {current}</Text>
                    </View>
                    <Pressable style={styles.fareBtn} onPress={() => bump(FARE_STEP)} hitSlop={4}>
                      <Ionicons name="add" size={20} color="#ffffff" />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Payment mini-bar */}
        <View style={styles.payBar}>
          <View style={styles.payLeft}>
            <Ionicons name="wallet-outline" size={20} color={colors.textMuted} />
            <Text style={styles.payText}>Cash Payment</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>

        {/* Bidding hint */}
        <View style={styles.hintRow}>
          <Ionicons name="pricetags-outline" size={15} color={colors.textMuted} />
          <Text style={styles.hint}>
            {standardFare
              ? `Standard fare is Rs ${standardFare}. Offer this or more — drivers bid and you pick the best one.`
              : 'Drivers bid on your offer. You pick the best one.'}
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
      <Pressable
        onPress={onConfirm}
        disabled={!canConfirm || loading}
        style={({ pressed }) => [
          styles.cta,
          pressed && !loading && styles.ctaPressed,
          (!canConfirm || loading) && styles.ctaDisabled,
        ]}
      >
        <Text style={styles.ctaText}>
          {loading
            ? 'Creating trip…'
            : `Request ${vehicle?.name} · Rs ${priceNum || suggested}`}
        </Text>
        {!loading && <Ionicons name="arrow-forward" size={20} color="#ffffff" />}
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.primary },
  avgChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  avgChipText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  routeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
  },
  routeText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  routeTextMissing: { color: colors.danger, fontStyle: 'italic' },
  routeArrow: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodyBold },
  warn: {
    fontFamily: fonts.bodySemibold,
    color: colors.danger,
    fontSize: 12,
    marginTop: 8,
  },

  rideList: { gap: 12, marginTop: 20 },
  rideCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rideCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  rideArt: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideArtSelected: { backgroundColor: 'rgba(255,255,255,0.1)' },
  rideName: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text },
  rideNote: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  rideRight: { alignItems: 'flex-end' },
  ridePrice: { fontFamily: fonts.monoSemibold, fontSize: 20, color: colors.text },
  recommended: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginTop: 2,
  },
  recommendedOnDark: { color: 'rgba(255,255,255,0.7)' },
  textOnDark: { color: '#ffffff' },
  subOnDark: { color: 'rgba(255,255,255,0.7)' },

  fareAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fareBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fareCenter: { alignItems: 'center' },
  fareLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.7)',
  },
  fareValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 22,
    color: '#ffffff',
    marginTop: 2,
  },

  payBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 4 },
  hint: { flex: 1, fontFamily: fonts.body, color: colors.textMuted, fontSize: 12, lineHeight: 17 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 5,
  },
  ctaPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#ffffff' },
});
