import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, shadow, spacing, STATUS_TOP_PAD, type } from '../../theme';
import { Button } from '../../components/ui';
import { ACTION_LABEL } from './useDriverFlow';

function money(n) {
  return `NPR ${Number(n || 0).toLocaleString()}`;
}

// A single ride request card with a Bid action
function RequestCard({ trip, alreadyBid, onBid }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.rider}>{trip.userId?.name || 'Rider'}</Text>
        <Text style={styles.offered}>{money(trip.offeredPrice)}</Text>
      </View>
      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={styles.addr} numberOfLines={1}>{trip.pickup?.address}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.text }]} />
          <Text style={styles.addr} numberOfLines={1}>{trip.dropoff?.address}</Text>
        </View>
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.vehicle}>{trip.vehicleType}</Text>
        {alreadyBid ? (
          <View style={styles.bidPlaced}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.bidPlacedText}>Bid placed</Text>
          </View>
        ) : (
          <Button label="Place bid" size="sm" onPress={() => onBid(trip)} style={styles.bidBtn} />
        )}
      </View>
    </View>
  );
}

// Bid entry modal
function BidModal({ trip, onClose, onSubmit }) {
  const [amount, setAmount] = useState(String(trip?.offeredPrice ?? ''));
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n < 50) {
      Alert.alert('Invalid amount', 'Enter a fare of at least NPR 50.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trip._id, n, message.trim() || null);
      onClose();
    } catch (err) {
      Alert.alert('Could not place bid', err.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Your fare offer</Text>
        <Text style={styles.sheetSub} numberOfLines={1}>
          {trip?.pickup?.address} → {trip?.dropoff?.address}
        </Text>
        <Text style={styles.sheetHint}>Rider offered {money(trip?.offeredPrice)}</Text>

        <View style={styles.amountRow}>
          <Text style={styles.npr}>NPR</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            autoFocus
          />
        </View>
        <TextInput
          style={styles.msgInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Message to rider (optional)"
          placeholderTextColor={colors.textFaint}
        />
        <Button
          label={submitting ? 'Sending…' : 'Send bid'}
          onPress={submit}
          disabled={submitting}
        />
      </View>
    </Modal>
  );
}

// Active trip: drive it to completion
function ActiveTrip({ trip, advancing, onAdvance, onFinish }) {
  const completed = trip.status === 'completed';
  const phone = trip.userId?.phone;

  const call = () => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.activeWrap}>
      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>
          {completed ? 'TRIP COMPLETED' : trip.status.toUpperCase()}
        </Text>
      </View>

      <View style={styles.riderCard}>
        <View style={styles.riderAvatar}>
          <Text style={styles.riderInitial}>
            {(trip.userId?.name || 'R').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName}>{trip.userId?.name || 'Rider'}</Text>
          <Text style={styles.fare}>{money(trip.finalPrice || trip.offeredPrice)} · {trip.paymentMethod}</Text>
        </View>
        {phone ? (
          <Pressable style={styles.callBtn} onPress={call} hitSlop={8}>
            <Ionicons name="call" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={styles.addr}>{trip.pickup?.address}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.text }]} />
            <Text style={styles.addr}>{trip.dropoff?.address}</Text>
          </View>
        </View>
      </View>

      {completed ? (
        <View style={styles.doneBox}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.doneTitle}>You earned {money(trip.finalPrice || trip.offeredPrice)}</Text>
          <Text style={styles.doneSub}>Platform fee is deducted automatically.</Text>
          <Button label="Done" onPress={onFinish} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <Button
          label={advancing ? 'Updating…' : ACTION_LABEL[trip.status] || 'Continue'}
          onPress={onAdvance}
          disabled={advancing}
          style={{ marginTop: spacing.lg }}
        />
      )}
    </ScrollView>
  );
}

// Slide-to-confirm control shown while offline: the driver drags the thumb to
// the far end to go online. Falls back to a spring-back if not dragged far enough.
const SLIDE_THUMB = 52;

function SlideToGoOnline({ onConfirm, disabled, resetSignal }) {
  const [trackW, setTrackW] = useState(0);
  const maxXRef = useRef(0);
  const x = useRef(new Animated.Value(0)).current;
  const confirmed = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // Reset the thumb to the start (e.g. after a failed go-online attempt).
  useEffect(() => {
    confirmed.current = false;
    Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
  }, [resetSignal, x]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const nx = Math.min(Math.max(0, g.dx), maxXRef.current);
        x.setValue(nx);
      },
      onPanResponderRelease: (_, g) => {
        const maxX = maxXRef.current;
        const nx = Math.min(Math.max(0, g.dx), maxX);
        if (maxX > 0 && nx >= maxX * 0.8 && !confirmed.current) {
          confirmed.current = true;
          Animated.timing(x, { toValue: maxX, duration: 120, useNativeDriver: false })
            .start(() => onConfirmRef.current?.());
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
        }
      },
    })
  ).current;

  const onLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    setTrackW(w);
    maxXRef.current = Math.max(0, w - SLIDE_THUMB - 8);
  };

  return (
    <View style={[styles.slideTrack, disabled && { opacity: 0.6 }]} onLayout={onLayout}>
      <Animated.View style={[styles.slideFill, { width: Animated.add(x, SLIDE_THUMB + 4) }]} />
      <Text style={styles.slideLabel}>Slide to go online</Text>
      <Animated.View
        style={[styles.slideThumb, { transform: [{ translateX: x }] }]}
        {...(disabled ? {} : pan.panHandlers)}
      >
        <Ionicons name="chevron-forward" size={26} color="#fff" />
      </Animated.View>
    </View>
  );
}

// Offline illustration by vehicle type: taxi drivers see the car image;
// everyone else sees the tuktuk (default for now).
const OFFLINE_IMAGES = {
  taxi: require('../../assets/ev-car.png'),
};
const DEFAULT_OFFLINE_IMAGE = require('../../assets/ev-tuktuk.png');

const VEHICLE_LABELS = {
  bike: 'Bike',
  scooter: 'Scooter',
  tuktuk: 'Tuk-tuk',
  tuktuk_delivery: 'Tuk-tuk (Delivery)',
  taxi: 'Taxi',
  comfort: 'Comfort',
};

export default function DriverHome({ flow, vehicleType }) {
  const { user } = useAuth();
  const [bidTrip, setBidTrip] = useState(null);
  const offlineImage = OFFLINE_IMAGES[vehicleType] || DEFAULT_OFFLINE_IMAGE;

  const {
    online,
    togglingOnline,
    toggleOnline,
    nearbyTrips,
    loadingTrips,
    bidTripIds,
    error,
    placeBid,
    activeTrip,
    advancing,
    advanceTrip,
    finishActiveTrip,
  } = flow;

  const [slideReset, setSlideReset] = useState(0);

  const onToggle = async (val) => {
    try {
      await toggleOnline(val);
    } catch (err) {
      Alert.alert('Status', err.message || 'Could not change status.');
    }
  };

  // Slide-to-go-online: go online, and snap the slider back if it fails.
  const onSlideConfirm = async () => {
    try {
      await toggleOnline(true);
    } catch (err) {
      Alert.alert('Status', err.message || 'Could not go online.');
      setSlideReset((n) => n + 1);
    }
  };

  // Driving an active trip takes over the whole screen
  if (activeTrip) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.brand}>Active trip</Text>
        </View>
        <ActiveTrip
          trip={activeTrip}
          advancing={advancing}
          onAdvance={async () => {
            try { await advanceTrip(); }
            catch (err) { Alert.alert('Trip', err.message || 'Could not update.'); }
          }}
          onFinish={finishActiveTrip}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.hi}>Hi, {user?.name?.split(' ')[0] || 'Driver'}</Text>
          {vehicleType && (
            <View style={styles.vehiclePill}>
              <Ionicons name="car-sport" size={13} color={colors.primary} />
              <Text style={styles.vehicleText}>{VEHICLE_LABELS[vehicleType] || vehicleType}</Text>
            </View>
          )}
        </View>
        {/* The toggle only appears once online — offline uses the slider below. */}
        {online && (
          <View style={styles.headerToggle}>
            <Text style={[styles.onlineLabel, { color: colors.success }]}>Online</Text>
            <Switch
              value={online}
              onValueChange={onToggle}
              disabled={togglingOnline}
              trackColor={{ true: colors.success, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        )}
      </View>

      {!online ? (
        <View style={styles.empty}>
          <Image
            source={offlineImage}
            style={styles.carImg}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>You're offline</Text>
          <Text style={styles.emptySub}>
            Go online to start receiving nearby ride requests.
          </Text>
          <SlideToGoOnline
            onConfirm={onSlideConfirm}
            disabled={togglingOnline}
            resetSignal={slideReset}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.sectionTitle}>
            Ride requests {nearbyTrips.length ? `(${nearbyTrips.length})` : ''}
          </Text>
          {loadingTrips && nearbyTrips.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : nearbyTrips.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={44} color={colors.textFaint} />
              <Text style={styles.emptySub}>
                No requests nearby yet. New ones appear here automatically.
              </Text>
            </View>
          ) : (
            nearbyTrips.map((trip) => (
              <RequestCard
                key={trip._id}
                trip={trip}
                alreadyBid={bidTripIds.includes(trip._id)}
                onBid={setBidTrip}
              />
            ))
          )}
        </ScrollView>
      )}

      {bidTrip && (
        <BidModal
          trip={bidTrip}
          onClose={() => setBidTrip(null)}
          onSubmit={placeBid}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerCenter: { alignItems: 'center', gap: 4 },
  hi: { ...type.bodyBold, color: colors.text, textAlign: 'center' },
  vehiclePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  vehicleText: { ...type.caption, color: colors.primary, fontWeight: '700', textTransform: 'capitalize' },
  brand: { ...type.h2, color: colors.text },
  headerToggle: {
    position: 'absolute', right: spacing.xl, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineLabel: { ...type.bodyBold, color: colors.textMuted },

  // Slide-to-go-online control
  slideTrack: {
    marginTop: spacing.xxl,
    width: '100%',
    maxWidth: 320,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slideFill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primarySoft,
    borderRadius: 30,
  },
  slideLabel: { ...type.bodyBold, color: colors.primary, textAlign: 'center' },
  slideThumb: {
    position: 'absolute',
    left: 4, top: 4,
    width: SLIDE_THUMB, height: SLIDE_THUMB,
    borderRadius: SLIDE_THUMB / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },

  list: { padding: spacing.xl, paddingBottom: spacing.xxl },
  sectionTitle: { ...type.bodyBold, color: colors.text, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  carImg: { width: 260, height: 180, marginBottom: spacing.sm },
  emptyTitle: { ...type.h3, color: colors.text, marginTop: spacing.sm },
  emptySub: { ...type.body, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rider: { ...type.bodyBold, color: colors.text },
  offered: { ...type.h3, color: colors.primary },
  route: { marginTop: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  routeLine: { width: 1, height: 14, backgroundColor: colors.border, marginLeft: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  addr: { ...type.body, color: colors.text, flex: 1 },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md,
  },
  vehicle: {
    ...type.caption, color: colors.textMuted, textTransform: 'capitalize',
    backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  bidBtn: { paddingHorizontal: spacing.xl },
  bidPlaced: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bidPlacedText: { ...type.caption, color: colors.primary, fontWeight: '700' },

  // Bid modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetSub: { ...type.body, color: colors.textMuted },
  sheetHint: { ...type.caption, color: colors.primary },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  npr: { ...type.bodyBold, color: colors.textMuted },
  amountInput: { flex: 1, ...type.h2, color: colors.text, paddingVertical: spacing.md },
  msgInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...type.body, color: colors.text,
  },

  // Active trip
  activeWrap: { padding: spacing.xl, paddingBottom: spacing.xxl },
  statusPill: {
    alignSelf: 'flex-start', backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  statusPillText: { ...type.caption, color: colors.primaryDark, fontWeight: '800', letterSpacing: 0.5 },
  riderCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md,
  },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  riderInitial: { ...type.h3, color: colors.primaryDark },
  riderName: { ...type.bodyBold, color: colors.text },
  fare: { ...type.caption, color: colors.textMuted, textTransform: 'capitalize' },
  callBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBox: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.xs },
  doneTitle: { ...type.h2, color: colors.text, marginTop: spacing.sm },
  doneSub: { ...type.body, color: colors.textMuted, textAlign: 'center' },
});
