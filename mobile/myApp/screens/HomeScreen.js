import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PaymentLogo, VehiclePhoto } from '../components/Brand';
import {
  CallIcon,
  ChatIcon,
  ChevronIcon,
  FlagIcon,
  PinIcon,
  SearchIcon,
  ShareIcon,
  StarIcon,
} from '../components/Icons';
import {
  BIDS,
  CURRENT_USER,
  NEARBY_DRIVERS,
  RECENT_DESTINATIONS,
  VEHICLE_TYPES,
} from '../data/mockData';
import { colors } from '../theme/colors';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'esewa', label: 'eSewa' },
  { id: 'khalti', label: 'Khalti' },
  { id: 'wallet', label: 'Wallet' },
];

export default function HomeScreen({ onOpenProfile }) {
  const [step, setStep] = useState('home');
  const [pickup, setPickup] = useState('Current location');
  const [destination, setDestination] = useState('');
  const [vehicleId, setVehicleId] = useState('taxi');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [payment, setPayment] = useState(CURRENT_USER.preferredPaymentMethod);
  const [acceptedBid, setAcceptedBid] = useState(null);
  const [tripStatus, setTripStatus] = useState('arriving');

  const vehicle = VEHICLE_TYPES.find((v) => v.id === vehicleId);
  const acceptedDriver = acceptedBid
    ? NEARBY_DRIVERS.find((d) => d._id === acceptedBid.driverId)
    : null;

  useEffect(() => {
    if (step !== 'bidding') return;
    setAcceptedBid(null);
  }, [step]);

  const reset = () => {
    setStep('home');
    setDestination('');
    setVehicleId('taxi');
    setOfferedPrice('');
    setAcceptedBid(null);
    setTripStatus('arriving');
  };

  const goBack = () => {
    if (step === 'search') setStep('home');
    else if (step === 'options') setStep('search');
    else if (step === 'bidding') setStep('options');
    else if (step === 'active') reset();
  };

  const handleConfirmRequest = () => {
    if (!destination.trim()) return;
    const price = Number(offeredPrice);
    if (!price || price < 50) return;
    setStep('bidding');
  };

  const handleAcceptBid = (bid) => {
    setAcceptedBid(bid);
    setStep('active');
    setTripStatus('arriving');
    setTimeout(() => setTripStatus('started'), 4000);
  };

  return (
    <View style={styles.root}>
      <Map step={step} />

      <View style={styles.topBar}>
        {step === 'home' ? (
          <Pressable style={styles.circleBtn} onPress={onOpenProfile} hitSlop={8}>
            <Text style={styles.avatarLetter}>
              {CURRENT_USER.name.charAt(0)}
            </Text>
          </Pressable>
        ) : step !== 'active' ? (
          <Pressable style={styles.circleBtn} onPress={goBack} hitSlop={8}>
            <View style={styles.backArrow} />
          </Pressable>
        ) : (
          <View />
        )}
        {step === 'home' && (
          <View style={styles.greetingPill}>
            <View style={styles.greetingDot} />
            <Text style={styles.greetingText}>
              {CURRENT_USER.name.split(' ')[0]}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        {step === 'home' && (
          <HomeSheet
            onTapSearch={() => setStep('search')}
            onPickSaved={(addr) => {
              setDestination(addr);
              setStep('options');
            }}
          />
        )}
        {step === 'search' && (
          <SearchSheet
            pickup={pickup}
            setPickup={setPickup}
            destination={destination}
            setDestination={setDestination}
            onPick={(value) => {
              setDestination(value);
              setStep('options');
            }}
            onSubmit={() => destination.trim() && setStep('options')}
          />
        )}
        {step === 'options' && (
          <OptionsSheet
            pickup={pickup}
            destination={destination}
            vehicleId={vehicleId}
            setVehicleId={setVehicleId}
            offeredPrice={offeredPrice}
            setOfferedPrice={setOfferedPrice}
            payment={payment}
            setPayment={setPayment}
            onConfirm={handleConfirmRequest}
          />
        )}
        {step === 'bidding' && (
          <BiddingSheet
            vehicle={vehicle}
            offeredPrice={Number(offeredPrice)}
            onAccept={handleAcceptBid}
            onCancel={() => setStep('options')}
          />
        )}
        {step === 'active' && acceptedBid && acceptedDriver && (
          <ActiveTripSheet
            driver={acceptedDriver}
            bid={acceptedBid}
            destination={destination}
            payment={payment}
            tripStatus={tripStatus}
            onComplete={reset}
            onCancel={reset}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function HomeSheet({ onTapSearch, onPickSaved }) {
  const tiles = [
    { id: 'ride', label: 'Ride', sub: 'Bid your fare', type: 'taxi' },
    { id: 'delivery', label: 'Delivery', sub: 'Send parcels', type: 'tuktuk_delivery' },
    { id: 'tuktuk', label: 'Tuktuk', sub: 'Local & cheap', type: 'tuktuk' },
    { id: 'subscribe', label: 'Subscribe', sub: 'Daily rides', type: 'bike' },
  ];
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <Text style={styles.bigHeading}>Where to?</Text>

      <Pressable style={styles.searchBar} onPress={onTapSearch}>
        <SearchIcon size={18} color={colors.text} />
        <Text style={styles.searchPlaceholder}>Search destination</Text>
        <View style={styles.searchTrail}>
          <Text style={styles.searchLater}>Later</Text>
        </View>
      </Pressable>

      <View style={styles.tilesGrid}>
        {tiles.map((t, i) => (
          <Pressable
            key={t.id}
            style={[styles.tile, i === 0 && styles.tileHighlight]}
          >
            <View style={styles.tileIcon}>
              <VehiclePhoto type={t.type} size={56} />
            </View>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.savedSectionRow}>
        <Text style={styles.savedSectionTitle}>Saved places</Text>
        <Pressable hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      <View style={styles.savedList}>
        {CURRENT_USER.savedAddresses.slice(0, 2).map((s, i, arr) => (
          <Pressable
            key={s.label}
            style={[styles.savedRow, i !== arr.length - 1 && styles.savedRowDivider]}
            onPress={() => onPickSaved(s.address)}
          >
            <View style={styles.savedIcon}>
              <PinIcon size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedLabel}>
                {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
              </Text>
              <Text style={styles.savedAddress} numberOfLines={1}>
                {s.address}
              </Text>
            </View>
            <ChevronIcon dir="right" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SearchSheet({ pickup, setPickup, destination, setDestination, onPick, onSubmit }) {
  return (
    <View style={[styles.sheet, styles.sheetTall]}>
      <View style={styles.handle} />

      <View style={styles.routeBox}>
        <View style={styles.routeIcons}>
          <PinIcon size={14} color={colors.primary} />
          <View style={styles.vline} />
          <FlagIcon size={14} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            value={pickup}
            onChangeText={setPickup}
            placeholder="Pickup"
            placeholderTextColor={colors.textFaint}
            style={styles.routeInput}
          />
          <View style={styles.routeDivider} />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Where to?"
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={styles.routeInput}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
        {CURRENT_USER.savedAddresses.map((s) => (
          <Pressable
            key={s.label}
            style={styles.suggestion}
            onPress={() => onPick(s.address)}
          >
            <View style={styles.suggestionIcon}>
              <View style={styles.suggestionIconCore} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>
                {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
              </Text>
              <Text style={styles.suggestionSub} numberOfLines={1}>
                {s.address}
              </Text>
            </View>
          </Pressable>
        ))}
        {RECENT_DESTINATIONS.map((r) => (
          <Pressable
            key={r.id}
            style={styles.suggestion}
            onPress={() => onPick(r.title)}
          >
            <View style={styles.suggestionIconRound} />
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>{r.title}</Text>
              <Text style={styles.suggestionSub} numberOfLines={1}>
                {r.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function OptionsSheet({
  pickup,
  destination,
  vehicleId,
  setVehicleId,
  offeredPrice,
  setOfferedPrice,
  payment,
  setPayment,
  onConfirm,
}) {
  const vehicle = VEHICLE_TYPES.find((r) => r.id === vehicleId);
  const suggested = vehicle?.baseFare ?? 0;
  const priceNum = Number(offeredPrice) || 0;
  const canConfirm = priceNum >= 50 && destination.trim().length > 0;

  return (
    <View style={[styles.sheet, styles.sheetTall]}>
      <View style={styles.handle} />

      <View style={styles.routeStrip}>
        <PinIcon size={10} color={colors.primary} />
        <Text style={styles.routeStripText} numberOfLines={1}>
          {pickup}
        </Text>
        <Text style={styles.routeStripArrow}>→</Text>
        <FlagIcon size={10} color={colors.text} />
        <Text style={styles.routeStripText} numberOfLines={1}>
          {destination}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Choose a ride</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.vehicleRow}
      >
        {VEHICLE_TYPES.map((r) => {
          const selected = r.id === vehicleId;
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                setVehicleId(r.id);
                if (!offeredPrice) setOfferedPrice(String(r.baseFare));
              }}
              style={[styles.vehicleCard, selected && styles.vehicleCardSelected]}
            >
              <View style={styles.vehicleArt}>
                <VehiclePhoto type={r.id} size={56} />
              </View>
              <Text style={styles.vehicleName}>{r.name}</Text>
              <View style={styles.vehicleMetaRow}>
                <View style={styles.dotTiny} />
                <Text style={styles.vehicleMeta}>{r.eta} min</Text>
              </View>
              <Text style={styles.vehiclePrice}>Rs {r.baseFare}</Text>
              <Text style={styles.vehicleNote} numberOfLines={1}>
                {r.note}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Your offer</Text>
      <View style={styles.offerBox}>
        <Text style={styles.offerCurrency}>Rs</Text>
        <TextInput
          value={offeredPrice}
          onChangeText={(t) => setOfferedPrice(t.replace(/[^0-9]/g, ''))}
          placeholder={String(suggested)}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          style={styles.offerInput}
        />
        <View style={styles.offerQuick}>
          <Pressable
            style={styles.offerChip}
            onPress={() => setOfferedPrice(String(Math.max(50, suggested - 30)))}
          >
            <Text style={styles.offerChipText}>−30</Text>
          </Pressable>
          <Pressable
            style={styles.offerChip}
            onPress={() => setOfferedPrice(String(suggested))}
          >
            <Text style={styles.offerChipText}>Suggested</Text>
          </Pressable>
          <Pressable
            style={styles.offerChip}
            onPress={() => setOfferedPrice(String(suggested + 30))}
          >
            <Text style={styles.offerChipText}>+30</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.offerHint}>
        Drivers will bid on your offer. You pick the best one.
      </Text>

      <Text style={styles.sectionLabel}>Payment</Text>
      <View style={styles.paymentRowList}>
        {PAYMENT_METHODS.map((p) => {
          const selected = payment === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.paymentChip, selected && styles.paymentChipSelected]}
              onPress={() => setPayment(p.id)}
            >
              <PaymentLogo id={p.id} size={20} />
              <Text
                style={[
                  styles.paymentChipText,
                  selected && styles.paymentChipTextSelected,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
          !canConfirm && styles.ctaDisabled,
        ]}
        onPress={onConfirm}
        disabled={!canConfirm}
      >
        <Text style={styles.ctaText}>
          Request {vehicle?.name} for Rs {priceNum || suggested}
        </Text>
      </Pressable>
    </View>
  );
}

function BiddingSheet({ vehicle, offeredPrice, onAccept, onCancel }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [bids, setBids] = useState([]);
  const [seconds, setSeconds] = useState(0);

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
  }, []);

  useEffect(() => {
    const timers = BIDS.map((b, i) =>
      setTimeout(() => {
        setBids((prev) => [...prev, b]);
      }, 1200 * (i + 1)),
    );
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={[styles.sheet, styles.sheetTall]}>
      <View style={styles.handle} />

      <View style={styles.bidHeader}>
        <View>
          <Text style={styles.bigHeading}>Receiving bids</Text>
          <Text style={styles.softSub}>
            Your offer Rs {offeredPrice} · {vehicle?.name}
          </Text>
        </View>
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>{seconds}s</Text>
        </View>
      </View>

      <View style={styles.miniPulse}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
        <View style={styles.pulseCore} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
        {bids.length === 0 ? (
          <Text style={styles.waitingText}>Waiting for drivers nearby…</Text>
        ) : (
          bids.map((b) => {
            const driver = NEARBY_DRIVERS.find((d) => d._id === b.driverId);
            if (!driver) return null;
            const diff = b.amount - offeredPrice;
            return (
              <View key={b._id} style={styles.bidCard}>
                <View style={styles.bidAvatar}>
                  <Text style={styles.bidInitials}>
                    {driver.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)}
                  </Text>
                  <View style={styles.bidAvatarBadge}>
                    <VehiclePhoto type={driver.vehicleType} size={20} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.bidTopRow}>
                    <Text style={styles.bidName}>{driver.name}</Text>
                    <View style={styles.bidRatingPill}>
                      <StarIcon size={11} />
                      <Text style={styles.bidRating}>
                        {driver.rating.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bidMeta} numberOfLines={1}>
                    {driver.vehicleColor} {driver.vehicleModel} · {driver.eta} min away
                  </Text>
                  {b.message ? (
                    <Text style={styles.bidMessage}>“{b.message}”</Text>
                  ) : null}
                </View>
                <View style={styles.bidRight}>
                  <Text style={styles.bidAmount}>Rs {b.amount}</Text>
                  <Text
                    style={[
                      styles.bidDiff,
                      diff === 0 && styles.bidDiffSame,
                      diff > 0 && styles.bidDiffHigh,
                      diff < 0 && styles.bidDiffLow,
                    ]}
                  >
                    {diff === 0 ? 'matches' : diff > 0 ? `+Rs ${diff}` : `−Rs ${-diff}`}
                  </Text>
                  <Pressable style={styles.bidAccept} onPress={() => onAccept(b)}>
                    <Text style={styles.bidAcceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable style={styles.cancelGhost} onPress={onCancel}>
        <Text style={styles.cancelGhostText}>Cancel request</Text>
      </Pressable>
    </View>
  );
}

function ActiveTripSheet({
  driver,
  bid,
  destination,
  payment,
  tripStatus,
  onComplete,
  onCancel,
}) {
  const initials = driver.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  const status =
    tripStatus === 'arriving'
      ? 'Driver on the way'
      : tripStatus === 'started'
      ? 'On the trip'
      : 'Trip complete';

  return (
    <View style={[styles.sheet, styles.sheetTall]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.handle} />

        <Text style={styles.kicker}>{status}</Text>
        <Text style={styles.bigEta}>
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
              {driver.rating.toFixed(2)} · {driver.vehicleColor} {driver.vehicleModel}
            </Text>
          </View>
          <View style={styles.plateBox}>
            <Text style={styles.plateText}>{driver.vehiclePlate}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn}>
            <CallIcon size={16} color={colors.primary} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <ChatIcon size={16} color="#5c6fff" />
            <Text style={styles.actionText}>Message</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <ShareIcon size={16} color={colors.text} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.detailList}>
          <DetailRow label="Pickup" value="Current location" />
          <DetailRow label="Drop-off" value={destination} />
          <DetailRow
            label="Payment"
            value={PAYMENT_METHODS.find((p) => p.id === payment)?.label || payment}
          />
          <DetailRow label="Agreed fare" value={`Rs ${bid.amount}`} bold last />
        </View>

        {tripStatus === 'started' ? (
          <Pressable style={styles.cta} onPress={onComplete}>
            <Text style={styles.ctaText}>Mark trip complete</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.cancelText} onPress={onCancel}>
            <Text style={styles.cancelTextLabel}>Cancel ride</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, bold, last }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, bold && styles.detailValueBold]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Map({ step }) {
  return (
    <View style={styles.map}>
      <View style={[styles.mapPath, styles.mapPathA]} />
      <View style={[styles.mapPath, styles.mapPathB]} />
      <View style={[styles.mapPath, styles.mapPathC]} />
      <View style={[styles.mapPath, styles.mapPathD]} />
      <View style={[styles.mapPath, styles.mapPathE]} />
      <View style={[styles.mapBlock, styles.mapBlockA]} />
      <View style={[styles.mapBlock, styles.mapBlockB]} />
      <View style={[styles.mapBlock, styles.mapBlockC]} />
      <View style={[styles.mapBlock, styles.mapBlockD]} />
      <View style={[styles.mapPark]} />

      <View style={styles.mapPinShadow} />
      <View style={styles.mapPin}>
        <View style={styles.mapPinCore} />
      </View>

      {(step === 'bidding' || step === 'active') && (
        <View style={styles.mapDriver}>
          <View style={styles.mapDriverCore} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e8ece6',
    overflow: 'hidden',
  },
  mapPath: { position: 'absolute', backgroundColor: '#f5f7f3' },
  mapPathA: { top: 130, left: -50, right: -50, height: 22, transform: [{ rotate: '-6deg' }] },
  mapPathB: { top: 240, left: -50, right: -50, height: 12, transform: [{ rotate: '4deg' }] },
  mapPathC: { top: 80, left: 130, width: 14, height: 320, transform: [{ rotate: '14deg' }] },
  mapPathD: { top: 60, right: 70, width: 10, height: 280, transform: [{ rotate: '-10deg' }] },
  mapPathE: { top: 380, left: -50, right: -50, height: 8, transform: [{ rotate: '7deg' }] },
  mapBlock: { position: 'absolute', backgroundColor: '#d6dcd2', borderRadius: 4 },
  mapBlockA: { top: 170, left: 24, width: 92, height: 56 },
  mapBlockB: { top: 200, right: 30, width: 110, height: 70 },
  mapBlockC: { top: 290, left: 50, width: 100, height: 46 },
  mapBlockD: { top: 360, right: 50, width: 90, height: 54 },
  mapPark: {
    position: 'absolute',
    top: 100,
    left: 30,
    width: 80,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#cfe0c9',
  },
  mapPin: {
    position: 'absolute',
    top: '34%',
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff' },
  mapPinShadow: {
    position: 'absolute',
    top: '37%',
    alignSelf: 'center',
    width: 32,
    height: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  mapDriver: {
    position: 'absolute',
    top: '22%',
    left: '28%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapDriverCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffffff' },

  topBar: {
    position: 'absolute',
    top: 56,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: { color: colors.text, fontSize: 16, fontWeight: '700' },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  greetingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  greetingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  greetingText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 14,
    elevation: 14,
  },
  sheetTall: { maxHeight: '88%' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cdd2cd',
    marginBottom: 16,
  },

  bigHeading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  softSub: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3f5f2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  searchPlaceholder: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  searchTrail: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchLater: { color: colors.text, fontSize: 12, fontWeight: '700' },

  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  tile: {
    width: '47.5%',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#f4f6f3',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileHighlight: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tileIcon: { height: 56, justifyContent: 'center', marginBottom: 6 },
  tileLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  tileSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  savedSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 4,
  },
  savedSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  seeAll: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  savedList: { marginTop: 8 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  savedRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  savedAddress: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: colors.textFaint,
    transform: [{ rotate: '45deg' }],
  },

  routeBox: {
    flexDirection: 'row',
    backgroundColor: '#f3f5f2',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  routeIcons: {
    alignItems: 'center',
    width: 16,
    marginRight: 14,
    paddingVertical: 6,
  },
  vline: { width: 2, flex: 1, backgroundColor: '#c5cac3', marginVertical: 4 },
  routeInput: { color: colors.text, fontSize: 16, paddingVertical: 8, padding: 0 },
  routeDivider: { height: 1, backgroundColor: '#cdd2cd', marginVertical: 2 },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f5f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconCore: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.text,
  },
  suggestionIconRound: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f5f2',
  },
  suggestionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  suggestionSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  routeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f3f5f2',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeStripText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  routeStripArrow: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 2,
  },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 10,
  },

  vehicleRow: { gap: 10, paddingRight: 4 },
  vehicleCard: {
    width: 132,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  vehicleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
  },
  vehicleArt: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  vehicleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  dotTiny: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  vehicleNote: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 6,
  },
  vehicleName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  vehicleMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  vehiclePrice: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 6 },

  offerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f5f2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offerCurrency: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  offerInput: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 6,
  },
  offerQuick: { flexDirection: 'row', gap: 6 },
  offerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cdd2cd',
  },
  offerChipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  offerHint: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  paymentRowList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  paymentChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  paymentChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  paymentChipTextSelected: { color: colors.primaryDark },

  cta: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDark },
  ctaDisabled: { backgroundColor: '#c4d3cb' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  bidHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  timerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  timerText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  miniPulse: {
    alignSelf: 'center',
    marginVertical: 8,
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

  waitingText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 18,
  },
  bidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  bidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bidAvatarBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    width: 28,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  bidInitials: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  bidTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bidName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  bidRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fff7e6',
  },
  bidRating: { color: '#8a5a14', fontSize: 11, fontWeight: '800' },
  bidMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bidMessage: { color: colors.text, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  bidRight: { alignItems: 'flex-end', gap: 4 },
  bidAmount: { color: colors.text, fontSize: 16, fontWeight: '800' },
  bidDiff: { fontSize: 11, fontWeight: '700' },
  bidDiffSame: { color: colors.textMuted },
  bidDiffHigh: { color: colors.danger },
  bidDiffLow: { color: colors.primary },
  bidAccept: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  bidAcceptText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  cancelGhost: { marginTop: 14, paddingVertical: 14, alignItems: 'center' },
  cancelGhostText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bigEta: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  etaBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cdd2cd',
    marginTop: 12,
    marginBottom: 18,
    overflow: 'hidden',
  },
  etaBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  driverAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f1f6f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: { color: colors.primaryDark, fontSize: 18, fontWeight: '700' },
  driverName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  driverMeta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  plateBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f3f5f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 18 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: '#f3f5f2',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  detailList: { backgroundColor: '#ffffff' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#cdd2cd',
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: colors.textMuted, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', maxWidth: '60%' },
  detailValueBold: { fontSize: 16, fontWeight: '800' },

  cancelText: { marginTop: 14, paddingVertical: 12, alignItems: 'center' },
  cancelTextLabel: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
