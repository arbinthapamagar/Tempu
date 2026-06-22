import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CallIcon, ChatIcon, ShareIcon } from '../../components/Icons';
import { Button, Sheet } from '../../components/ui';
import { colors, radius, shadow, spacing, type } from '../../theme';
import { PAYMENT_METHODS } from './constants';

const STATUS_LABEL = {
  arriving: 'Driver on the way',
  started: 'On the trip',
  completed: 'Trip complete',
};

function DetailRow({ label, value, bold, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, bold && styles.rowValueBold]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function ActiveTripSheet({
  driver,
  bid,
  destination,
  payment,
  tripStatus,
  onComplete,
  onCancel,
  onRate,
}) {
  const initials = driver.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
  const statusText = STATUS_LABEL[tripStatus] ?? STATUS_LABEL.arriving;
  const paymentLabel =
    PAYMENT_METHODS.find((p) => p.id === payment)?.label || payment;

  return (
    <Sheet tall>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{statusText}</Text>

        {/* Driver card — rounded sheet with avatar, name, rating pill, vehicle + plate */}
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitials}>{initials}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName} numberOfLines={1}>
                {driver.name}
              </Text>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={11} color={colors.primary} />
                <Text style={styles.ratingText}>{driver.rating.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.vehicleBlock}>
              <Text style={styles.vehicleText} numberOfLines={1}>
                {driver.vehicleColor} {driver.vehicleModel}
              </Text>
              <View style={styles.plate}>
                <Text style={styles.plateText}>{driver.vehiclePlate}</Text>
              </View>
            </View>
          </View>

          {/* ETA pill */}
          <View style={styles.etaRow}>
            <View style={styles.etaPill}>
              <Ionicons name="time-outline" size={13} color={colors.primary} />
              <Text style={styles.etaPillText}>
                {tripStatus === 'arriving'
                  ? `Arriving in ${driver.eta} min`
                  : tripStatus === 'started'
                  ? 'On the trip'
                  : 'Trip complete'}
              </Text>
            </View>
          </View>

          {/* Action FABs — call (orange), message, share */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.fab, styles.fabPrimary]}
              onPress={() => {
                if (driver.phone) {
                  Linking.openURL(`tel:${driver.phone}`);
                } else {
                  Alert.alert('Call Driver', 'Driver phone number is not available.');
                }
              }}
            >
              <CallIcon size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.fab, styles.fabSurface]}
              onPress={() => Alert.alert('Message', 'In-trip messaging is available once the driver arrives.')}
            >
              <ChatIcon size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              style={[styles.fab, styles.fabSurface]}
              onPress={() => Alert.alert('Share Trip', 'Trip sharing coming soon.')}
            >
              <ShareIcon size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Journey line — pickup → destination with endpoint dots */}
        <View style={styles.journeyCard}>
          <View style={styles.journeyRow}>
            <View style={styles.journeyTrack}>
              <View style={[styles.journeyDot, styles.journeyDotStart]} />
              <View style={styles.journeyLine} />
              <View style={[styles.journeyDot, styles.journeyDotEnd]} />
            </View>
            <View style={styles.journeyLabels}>
              <View style={styles.journeyStop}>
                <Text style={styles.journeyLabel}>Pickup</Text>
                <Text style={styles.journeyValue} numberOfLines={1}>
                  Current location
                </Text>
              </View>
              <View style={styles.journeyStopLast}>
                <Text style={styles.journeyLabel}>Drop-off</Text>
                <Text style={styles.journeyValue} numberOfLines={1}>
                  {destination}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fare & payment */}
        <View style={styles.detailList}>
          <DetailRow label="Payment" value={paymentLabel} />
          <DetailRow label="Agreed fare" value={`Rs ${bid.amount}`} bold last />
        </View>

        {tripStatus === 'completed' ? (
          <Button
            label="Rate & Close"
            onPress={onRate ?? onComplete}
            style={{ marginTop: spacing.md + 2 }}
          />
        ) : tripStatus === 'started' ? (
          <View style={styles.inProgress}>
            <Text style={styles.inProgressText}>Trip in progress · your driver will complete the ride</Text>
          </View>
        ) : (
          <Pressable style={styles.cancel} onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.cancelText}>Cancel ride</Text>
          </Pressable>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kicker: { ...type.eyebrow, color: colors.textMuted, marginBottom: spacing.md },

  // Driver card — rounded sheet over the map
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  driverInfo: { flex: 1, gap: 6 },
  driverName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  ratingText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  vehicleBlock: { alignItems: 'flex-end', gap: 6, maxWidth: '40%' },
  vehicleText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  plate: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: { color: colors.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  etaRow: { marginTop: spacing.md },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  etaPillText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPrimary: { backgroundColor: colors.primary, ...shadow.fab },
  fabSurface: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Journey line — pickup → destination
  journeyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  journeyRow: { flexDirection: 'row', gap: spacing.md },
  journeyTrack: { alignItems: 'center', paddingTop: 5 },
  journeyDot: { width: 12, height: 12, borderRadius: 6 },
  journeyDotStart: { backgroundColor: colors.primary },
  journeyDotEnd: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  journeyLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  journeyLabels: { flex: 1, justifyContent: 'space-between' },
  journeyStop: { marginBottom: spacing.lg },
  journeyStopLast: {},
  journeyLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  journeyValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },

  detailList: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
  },
  rowValueBold: { fontSize: 16, fontWeight: '800' },

  cancel: {
    marginTop: spacing.md + 2,
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
  inProgress: {
    marginTop: spacing.md + 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  inProgressText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
