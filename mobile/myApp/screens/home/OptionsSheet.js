import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VehiclePhoto } from '../../components/Brand';
import { FlagIcon, PinIcon } from '../../components/Icons';
import { Button, Sheet } from '../../components/ui';
import { VEHICLE_TYPES } from './useRideFlow';
import { colors, radius, shadow, spacing, type } from '../../theme';

const MIN_FARE = 50;
const FARE_STEP = 20;

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
        contentContainerStyle={{ paddingBottom: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select your ride</Text>
          {vehicle?.eta != null && (
            <View style={styles.etaPill}>
              <Ionicons name="time-outline" size={12} color={colors.primary} />
              <Text style={styles.etaPillText}>{vehicle.eta} min trip</Text>
            </View>
          )}
        </View>

        <View style={styles.routeStrip}>
          <PinIcon size={11} color={colors.primary} />
          <Text
            style={[
              styles.routeText,
              !pickupReady && styles.routeTextMissing,
            ]}
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

        <View style={styles.rideList}>
          {VEHICLE_TYPES.map((r) => {
            const selected = r.id === vehicleId;
            const current = Number(offeredPrice) || r.baseFare;
            const bump = (delta) =>
              setOfferedPrice(String(Math.max(floor, current + delta)));
            return (
              <View
                key={r.id}
                style={[
                  styles.rideCard,
                  selected && styles.rideCardSelected,
                ]}
              >
                <Pressable
                  onPress={() => selectVehicle(r.id, r.baseFare)}
                  style={styles.rideRow}
                >
                  <View
                    style={[
                      styles.rideArt,
                      selected && styles.rideArtSelected,
                    ]}
                  >
                    <VehiclePhoto type={r.id} size={40} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideName}>{r.name}</Text>
                    <Text style={styles.rideNote} numberOfLines={1}>
                      {r.note}
                    </Text>
                    <View style={styles.rideEtaRow}>
                      <Ionicons
                        name="time-outline"
                        size={11}
                        color={colors.textMuted}
                      />
                      <Text style={styles.rideEta}>{r.eta} min away</Text>
                    </View>
                  </View>
                  <View style={styles.rideRight}>
                    <Text style={styles.ridePrice}>
                      Rs {selected ? current : r.baseFare}
                    </Text>
                  </View>
                </Pressable>

                {selected && (
                  <View style={styles.fareAdjust}>
                    <Pressable
                      style={styles.fareBtn}
                      onPress={() => bump(-FARE_STEP)}
                      hitSlop={4}
                    >
                      <Ionicons name="remove" size={20} color={colors.text} />
                    </Pressable>
                    <View style={styles.fareCenter}>
                      <Text style={styles.fareLabel}>Your offer</Text>
                      <Text style={styles.fareValue}>Rs {current}</Text>
                    </View>
                    <Pressable
                      style={styles.fareBtn}
                      onPress={() => bump(FARE_STEP)}
                      hitSlop={4}
                    >
                      <Ionicons name="add" size={20} color={colors.text} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.promoCard}>
          <Ionicons
            name="pricetags-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.hint}>
            {standardFare
              ? `Standard fare is Rs ${standardFare}. Offer this or more — drivers bid and you pick the best one.`
              : 'Drivers bid on your offer. You pick the best one.'}
          </Text>
        </View>
      </ScrollView>

      <Button
        label={loading ? 'Creating trip…' : `Request ${vehicle?.name} · Rs ${priceNum || suggested}`}
        size="md"
        onPress={onConfirm}
        disabled={!canConfirm || loading}
        style={styles.cta}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...type.h1, color: colors.text },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  etaPillText: { ...type.caption, color: colors.primary, fontWeight: '700' },

  routeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeText: { flex: 1, ...type.small, color: colors.text, fontWeight: '500' },
  routeTextMissing: { color: colors.danger, fontStyle: 'italic' },
  routeArrow: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  warn: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  rideList: {
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  rideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rideCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    ...shadow.fab,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  rideArt: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rideArtSelected: { borderColor: colors.primary },
  rideName: { ...type.h3, color: colors.text },
  rideNote: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rideRight: { alignItems: 'flex-end' },
  ridePrice: { ...type.h3, color: colors.text, fontWeight: '800' },
  rideEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  rideEta: { color: colors.textMuted, fontSize: 11 },

  fareAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md + 2,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  fareBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fareCenter: { alignItems: 'center' },
  fareLabel: { ...type.eyebrow, color: colors.textMuted },
  fareValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },

  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hint: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  cta: {
    marginTop: spacing.lg,
    paddingVertical: 16,
  },
});
