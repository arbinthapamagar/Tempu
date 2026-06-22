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
import { colors, radius, spacing, type } from '../../theme';

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
        <View style={styles.routeStrip}>
          <PinIcon size={10} color={colors.primary} />
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
          <FlagIcon size={10} color={colors.text} />
          <Text style={styles.routeText} numberOfLines={1}>
            {destination}
          </Text>
        </View>

        {!pickupReady && (
          <Text style={styles.warn}>
            Pickup not detected — set it from the search screen to continue.
          </Text>
        )}

        <Text style={styles.sectionLabel}>Choose a ride</Text>

        <View style={styles.rideList}>
          {VEHICLE_TYPES.map((r, i) => {
            const selected = r.id === vehicleId;
            const current = Number(offeredPrice) || r.baseFare;
            const bump = (delta) =>
              setOfferedPrice(String(Math.max(floor, current + delta)));
            return (
              <View
                key={r.id}
                style={[
                  i !== VEHICLE_TYPES.length - 1 && styles.rideRowDivider,
                  selected && styles.rideRowSelected,
                ]}
              >
                <Pressable
                  onPress={() => selectVehicle(r.id, r.baseFare)}
                  style={styles.rideRow}
                >
                  <View style={styles.rideArt}>
                    <VehiclePhoto type={r.id} size={44} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideName}>{r.name}</Text>
                    <Text style={styles.rideNote} numberOfLines={1}>
                      {r.note}
                    </Text>
                  </View>
                  <View style={styles.rideRight}>
                    <Text style={styles.ridePrice}>
                      Rs {selected ? current : r.baseFare}
                    </Text>
                    <View style={styles.rideEtaRow}>
                      <Ionicons
                        name="time-outline"
                        size={11}
                        color={colors.textMuted}
                      />
                      <Text style={styles.rideEta}>{r.eta} min</Text>
                    </View>
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

        {standardFare ? (
          <Text style={styles.hint}>
            Standard fare is Rs {standardFare}. You can offer this or more — drivers
            then bid and you pick the best one.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Drivers bid on your offer. You pick the best one.
          </Text>
        )}
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
  routeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
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

  sectionLabel: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  rideList: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  rideRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rideRowSelected: { backgroundColor: colors.primarySoft },
  rideArt: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideName: { ...type.h3, color: colors.text },
  rideNote: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rideRight: { alignItems: 'flex-end' },
  ridePrice: { ...type.bodyBold, color: colors.text, fontWeight: '800' },
  rideEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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

  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  cta: {
    marginTop: spacing.md,
    paddingVertical: 16,
  },
});
