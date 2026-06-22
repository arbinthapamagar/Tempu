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
import { colors, radius, spacing, type } from '../../theme';
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
        <Text style={styles.eta}>
          {tripStatus === 'arriving' ? `${driver.eta} min` : '—'}
        </Text>
        <View style={styles.etaBar}>
          <View
            style={[
              styles.etaBarFill,
              { width: tripStatus === 'arriving' ? '40%' : '90%' },
            ]}
          />
        </View>

        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <Text style={styles.driverMeta}>
              {driver.rating.toFixed(2)} · {driver.vehicleColor}{' '}
              {driver.vehicleModel}
            </Text>
          </View>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{driver.vehiclePlate}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              if (driver.phone) {
                Linking.openURL(`tel:${driver.phone}`);
              } else {
                Alert.alert('Call Driver', 'Driver phone number is not available.');
              }
            }}
          >
            <CallIcon size={16} color={colors.primary} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => Alert.alert('Message', 'In-trip messaging is available once the driver arrives.')}
          >
            <ChatIcon size={16} color={colors.primary} />
            <Text style={styles.actionText}>Message</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => Alert.alert('Share Trip', 'Trip sharing coming soon.')}
          >
            <ShareIcon size={16} color={colors.text} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.detailList}>
          <DetailRow label="Pickup" value="Current location" />
          <DetailRow label="Drop-off" value={destination} />
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
  kicker: { ...type.eyebrow, color: colors.textMuted, marginBottom: 4 },
  eta: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  etaBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  etaBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingVertical: spacing.sm,
  },
  driverAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: { color: colors.primaryDark, fontSize: 18, fontWeight: '700' },
  driverName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  driverMeta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  plate: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md - 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md + 2,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: spacing.md + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  detailList: { backgroundColor: colors.surface },
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
