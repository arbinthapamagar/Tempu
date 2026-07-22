import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VehiclePhoto } from '../../components/Brand';
import { StarIcon } from '../../components/Icons';
import { Sheet } from '../../components/ui';
import { colors, radius, spacing, type } from '../../theme';

function diffLabel(amount, offered) {
  const diff = amount - offered;
  if (diff === 0) return 'matches';
  return diff > 0 ? `+Rs ${diff}` : `−Rs ${-diff}`;
}

function diffStyle(amount, offered) {
  const diff = amount - offered;
  if (diff === 0) return styles.diffSame;
  if (diff > 0) return styles.diffHigh;
  return styles.diffLow;
}

function getInitials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function BiddingSheet({ vehicle, offeredPrice, bids = [], onAccept, onCancel, timeoutSeconds = 180 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [remaining, setRemaining] = useState(timeoutSeconds);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    setRemaining(timeoutSeconds);
    const tick = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [timeoutSeconds]);

  function formatRemaining(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Sheet tall>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Receiving bids</Text>
          <Text style={styles.sub}>
            Your offer Rs {offeredPrice} · {vehicle?.name}
          </Text>
        </View>
        <View style={styles.timer}>
          <Text style={[styles.timerText, remaining < 60 && { color: colors.danger }]}>
            {formatRemaining(remaining)}
          </Text>
        </View>
      </View>

      <View style={styles.pulseStage}>
        <Animated.View
          style={[styles.pulseRing, { transform: [{ scale }], opacity }]}
        />
        <View style={styles.pulseCore} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
        {bids.length === 0 ? (
          <View style={styles.waitingRow}>
            {remaining === 0 ? (
              <Text style={styles.waiting}>No drivers found. Please try again.</Text>
            ) : (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.waiting}>Waiting for drivers nearby…</Text>
              </>
            )}
          </View>
        ) : (
          bids.map((b) => {
            const driver = b.driverId || {};
            const driverName = driver.userId?.name || 'Driver';
            const initials = getInitials(driverName);
            const rating = driver.rating ?? 0;
            const vehicleColor = driver.vehicleColor || '';
            const vehicleModel = driver.vehicleModel || '';
            const vehiclePlate = driver.vehiclePlate || '';
            const vehicleType = driver.vehicleType || vehicle?.id;

            return (
              <View key={b._id} style={styles.bidCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                  <View style={styles.avatarBadge}>
                    <VehiclePhoto type={vehicleType} size={20} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.bidTopRow}>
                    <Text style={styles.bidName}>{driverName}</Text>
                    {rating > 0 && (
                      <View style={styles.ratingPill}>
                        <StarIcon size={11} />
                        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.bidMeta} numberOfLines={1}>
                    {[vehicleColor, vehicleModel, vehiclePlate].filter(Boolean).join(' · ')}
                  </Text>
                  {b.message ? (
                    <Text style={styles.bidMessage}>"{b.message}"</Text>
                  ) : null}
                </View>
                <View style={styles.bidRight}>
                  <Text style={styles.bidAmount}>Rs {b.amount}</Text>
                  <Text style={[styles.diffBase, diffStyle(b.amount, offeredPrice)]}>
                    {diffLabel(b.amount, offeredPrice)}
                  </Text>
                  <Pressable style={styles.accept} onPress={() => onAccept(b)}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable style={styles.cancel} onPress={onCancel}>
        <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
        <Text style={styles.cancelText}>Cancel request</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heading: { ...type.display, fontSize: 28, color: colors.text },
  sub: { ...type.small, color: colors.textMuted, marginTop: 2 },
  timer: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  timerText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },

  pulseStage: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
  },
  pulseCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#ffffff',
  },

  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: spacing.lg,
  },
  waiting: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },

  bidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm + 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bidName: { ...type.bodyBold, color: colors.text, fontWeight: '700', flex: 1 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  ratingText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  bidMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bidMessage: { color: colors.text, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  bidRight: { alignItems: 'flex-end', gap: 4 },
  bidAmount: { color: colors.text, fontSize: 16, fontWeight: '800' },
  diffBase: { fontSize: 11, fontWeight: '700' },
  diffSame: { color: colors.textMuted },
  diffHigh: { color: colors.danger },
  diffLow: { color: colors.primary },
  accept: {
    marginTop: 4,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  acceptText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  cancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
});
