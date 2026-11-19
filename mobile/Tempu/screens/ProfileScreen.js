import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  TextInput,
} from 'react-native';
import DriverVehicleScreen from './DriverVehicleScreen';
import SupportScreen from './SupportScreen';
import WalletScreen from './WalletScreen';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ChevronIcon } from '../components/Icons';
import MapPicker from '../components/MapPicker';
import { confirm as hapticConfirm } from '../components/haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  Switch,
  Text,
  View,
} from 'react-native';
import RefreshControl from '../components/RefreshControl';
import { PaymentMethodPicker, useGatewayTopup, usePaymentMethods } from '../components/PaymentTopup';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import useBackHandler from '../utils/useBackHandler';
import { sendShortcut } from '../utils/sendShortcut';
import { type, radius, spacing } from '../theme';
import { getThemeMode, setThemeMode } from '../theme/themeStore';
import { reloadApp } from '../theme/reload';
import { fonts } from '../theme/type';


const PAYMENT_LABELS = {
  cash: 'Cash',
  khalti: 'Khalti',
  esewa: 'eSewa',
};

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };
const USER_TYPE_LABELS = {
  regular: 'Regular',
  parent: 'Parent',
  business: 'Business',
};

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfileScreen({ hideTitle, onBack, onSignOut, onOpenSubscription, onSwitchToDriver, onSwitchToPassenger, initialModal, onInitialModalShown }) {
  const { user, logout, refreshUser } = useAuth();

  const [driverProfile, setDriverProfile] = useState(null);
  const [driverStatus, setDriverStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected' | 'suspended'
  const [driverLoaded, setDriverLoaded] = useState(false); // false until the driver profile fetch resolves
  const [online, setOnline] = useState(false);
  const [avatarUri, setAvatarUri] = useState(user?.avatarUrl || null);
  const [driverOverlay, setDriverOverlay] = useState(null); // null | 'vehicle' | 'pending'
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    walletBalance: user?.walletBalance || 0,
  });

  // Mirror the context user into local form state so a pull-to-refresh (which
  // re-fetches the profile) actually shows the new name / wallet balance.
  useEffect(() => {
    if (!user) return;
    setProfile((p) => ({
      ...p,
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      walletBalance: user.walletBalance ?? p.walletBalance,
    }));
  }, [user]);

  const [addresses, setAddresses] = useState([]);
  const [modal, setModal] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [riderTrips, setRiderTrips] = useState(null);
  const [walletRefresh, setWalletRefresh] = useState(0); // bump → Wallet reloads
  // Opened straight into a form from elsewhere (Home's "Add new place").
  useEffect(() => {
    if (!initialModal) return;
    setModal({ type: initialModal });
    onInitialModalShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModal]);
  const closeModal = () => setModal(null);
  const [helpView, setHelpView] = useState(null); // null | 'support'
  const [sosBusy, setSosBusy] = useState(false);

  // SOS: open the sheet so the user can add an optional note before sending.
  const triggerSOS = () => setModal({ type: 'sos' });

  // Grab location and fire the emergency alert (it lands in the admin panel).
  // The note is optional - we send the alert with or without it. Location is
  // best-effort: we use the cached fix instantly and cap a fresh fix at 4s so
  // the SOS never hangs waiting for GPS (which can stall badly indoors).
  const sendSOS = async (note) => {
    setSosBusy(true);
    let loc = {};
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // Fast path: last known position is usually instant.
        let pos = await Location.getLastKnownPositionAsync();
        if (!pos) {
          // No cache - try a fresh fix but don't wait more than 4s.
          pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
          ]);
        }
        if (pos) loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch { /* send without location */ }
    try {
      await userApi.triggerEmergency({
        ...loc,
        message: note?.trim() || undefined,
        role: onSwitchToPassenger ? 'driver' : 'passenger',
      });
      closeModal();
      Alert.alert('Alert sent', 'Our safety team has been notified and is responding.');
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not send alert. Call local emergency services.');
    } finally {
      setSosBusy(false);
    }
  };

  const isDriver = driverStatus === 'approved';

  // Load saved addresses + check driver profile. Reused by pull-to-refresh.
  const load = useCallback(async () => {
    await Promise.all([
      userApi.getSavedAddresses().then((res) => {
        setAddresses(res.data || []);
      }).catch(() => {}),

      // Riders' trip count (the stat tile hard-coded 0 for non-drivers).
      userApi.getTripHistory(1, { limit: 1 }).then((res) => {
        setRiderTrips(res.data?.pagination?.total ?? 0);
      }).catch(() => {}),

      userApi.getMyDriverProfile().then((res) => {
        const dp = res.data?.driver || res.data;
        setDriverProfile(dp);
        setDriverStatus(dp?.status || null);
        setOnline(dp?.isOnline ?? false);
      }).catch((err) => {
        // Only "no driver profile" means not a driver. A timeout must not
        // show "Become a driver" to an approved/pending driver.
        if (!err?.network) setDriverStatus(null);
      }).finally(() => {
        setDriverLoaded(true);
      }),
    ]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // refreshUser repopulates name/phone/email/wallet from the server.
    await Promise.all([load(), refreshUser?.().catch(() => {})]);
    setRefreshing(false);
  }, [load, refreshUser]);

  // Hardware back closes whichever full-screen overlay is on top. The modals
  // below are RN <Modal>s, which already close themselves via onRequestClose.
  useBackHandler(() => {
    if (walletOpen) { setWalletOpen(false); return true; }
    if (driverOverlay) { setDriverOverlay(null); return true; }
    if (helpView) { setHelpView(null); return true; }
    return false;
  });

  const toggleOnline = useCallback(async (val) => {
    setOnline(val);
    try {
      if (val) {
        await userApi.goOnline();
      } else {
        await userApi.goOffline();
      }
    } catch (err) {
      setOnline(!val);
      Alert.alert('Error', err.message || 'Could not update status.');
    }
  }, []);

  const updateAddress = async (id, data) => {
    try {
      const res = await userApi.updateSavedAddress(id, data);
      setAddresses(res.data || []); // the server returns the whole updated list
      refreshUser?.();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update address.');
    }
  };
  const addAddress = async (label, address, coordinates) => {
    try {
      const res = await userApi.addSavedAddress({ label, address, coordinates });
      setAddresses(res.data || []); // the server returns the whole updated list
      refreshUser?.(); // Home's Saved Places reads user.savedAddresses
      return true;
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not add address.');
      return false;
    }
  };
  const removeAddress = async (id) => {
    try {
      await userApi.deleteSavedAddress(id);
      setAddresses((prev) => prev.filter((a) => a._id !== id));
      refreshUser?.(); // Home's Saved Places reads user.savedAddresses
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not remove address.');
    }
  };

  // Server-confirmed balance after a gateway top-up settles.
  const setWalletBalance = (balance) => {
    if (typeof balance === 'number') setProfile((p) => ({ ...p, walletBalance: balance }));
    refreshUser?.().catch?.(() => {});
  };
  // Settles payments even when the top-up sheet is closed (user returns from
  // eSewa / Khalti to this screen).
  const walletTopup = useGatewayTopup('wallet', ({ status, balance }) => {
    if (status === 'completed') setWalletBalance(balance);
    setWalletRefresh((k) => k + 1); // show the settled (or failed) top-up in history
  });

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      const prev = avatarUri;
      setAvatarUri(uri);
      try {
        await userApi.uploadAvatar(uri);
      } catch (err) {
        setAvatarUri(prev);
        Alert.alert('Upload failed', err.message || 'Could not upload avatar.');
      }
    }
  };

  const removeAvatar = () => {
    if (!avatarUri) return;
    Alert.alert('Remove photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const prev = avatarUri;
          setAvatarUri(null);
          try {
            await userApi.deleteAvatar();
          } catch (err) {
            setAvatarUri(prev);
            Alert.alert('Failed', err.message || 'Could not remove photo.');
          }
        },
      },
    ]);
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        {/* The passenger shell's top bar already says "Account". */}
        {!hideTitle && (
          // Centred on the screen, not between the (narrow) back and (wide)
          // Edit buttons, which pulled it off-centre.
          <View pointerEvents="none" style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Account</Text>
          </View>
        )}
        <Pressable
          style={styles.editBtn}
          onPress={() => setModal({ type: 'edit-profile' })}
          hitSlop={8}
        >
          <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.hero}>

          <Pressable
            style={styles.avatarWrap}
            onPress={pickAvatar}
            hitSlop={8}
          >
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
            {avatarUri && (
              <Pressable style={styles.removeBadge} onPress={removeAvatar} hitSlop={8}>
                <Ionicons name="trash" size={13} color="#ffffff" />
              </Pressable>
            )}
          </Pressable>

          <View style={styles.heroText}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {[profile.phone, profile.email].filter(Boolean).join('  ·  ')}
            </Text>
            {isDriver && (
              <View style={styles.driverBadge}>
                <Text style={styles.driverBadgeText}>Driver</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat
            value={(user?.rating?.average ?? 0).toFixed(2)}
            label="Rating"
          />
          <Stat
            value={isDriver ? String(driverProfile?.totalRides ?? 0) : riderTrips == null ? '-' : String(riderTrips)}
            label="Trips"
          />
          <Stat
            value={`Rs ${profile.walletBalance.toLocaleString()}`}
            label="Wallet"
            onPress={() => setWalletOpen(true)}
          />
          <Stat
            value={formatDate(user?.createdAt).split(' ')[2] || '-'}
            label="Joined"
            last
          />
        </View>

        {isDriver && onSwitchToDriver && (
          <Pressable style={styles.switchModeCard} onPress={onSwitchToDriver}>
            <View style={styles.switchModeLeft}>
              <Ionicons name="car-sport" size={20} color="#fff" />
              <View>
                <Text style={styles.switchModeTitle}>Switch to Driver mode</Text>
                <Text style={styles.switchModeSub}>Go online and accept ride requests</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}

        {onSwitchToPassenger && (
          <Pressable style={styles.switchModeCardAlt} onPress={onSwitchToPassenger}>
            <View style={styles.switchModeLeft}>
              <Ionicons name="person" size={20} color={colors.primaryDark} />
              <View>
                <Text style={styles.switchModeTitleAlt}>Switch to Passenger mode</Text>
                <Text style={styles.switchModeSubAlt}>Book rides as a passenger</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} />
          </Pressable>
        )}

        {driverLoaded && driverStatus === null && (
          <Pressable
            style={styles.becomeDriverCard}
            onPress={() => setDriverOverlay('vehicle')}
          >
            <View style={styles.becomeDriverLeft}>
              <Image
                source={require('../assets/ev-tuktuk.png')}
                style={styles.becomeDriverImg}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.becomeDriverTitle}>Become a driver</Text>
                <Text style={styles.becomeDriverSub}>Earn money driving in your city</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {(driverStatus === 'pending') && (
          <View style={styles.reviewBanner}>
            <Ionicons name="time-outline" size={22} color={colors.warn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewBannerTitle}>Documents under review</Text>
              <Text style={styles.reviewBannerSub}>
                Our team is reviewing your application. You'll be notified once approved.
              </Text>
            </View>
          </View>
        )}

        {(driverStatus === 'rejected') && (
          <View style={[styles.reviewBanner, styles.rejectedBanner]}>
            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.reviewBannerTitle, { color: colors.danger }]}>Application rejected</Text>
              <Text style={styles.reviewBannerSub}>
                Your application was not approved. Contact support for details.
              </Text>
            </View>
          </View>
        )}

        <Section title="Personal information" collapsible defaultOpen={false}>
          <Row label="Full name" value={profile.name} />
          <Row
            label="Phone"
            value={profile.phone}
            badge={user?.isPhoneVerified ? 'Verified' : 'Unverified'}
            badgeTone={user?.isPhoneVerified ? 'good' : 'warn'}
          />
          <Row
            label="Email"
            value={profile.email}
            badge={user?.isEmailVerified ? 'Verified' : 'Unverified'}
            badgeTone={user?.isEmailVerified ? 'good' : 'warn'}
          />
          <Row label="Date of birth" value={formatDate(user?.dateOfBirth)} />
          <Row label="Gender" value={GENDER_LABELS[user?.gender]} />
          <Row label="Account type" value={USER_TYPE_LABELS[user?.userType || 'regular']} last />
        </Section>

        <Section title="Wallet & payments">
          <View style={styles.walletCard}>
            <View>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              <Text style={styles.walletAmount}>
                Rs {profile.walletBalance.toLocaleString()}
              </Text>
            </View>
            <Pressable
              style={styles.topUpBtn}
              onPress={() => setModal({ type: 'topup' })}
            >
              <Text style={styles.topUpText}>Top up</Text>
            </Pressable>
          </View>
          <Row
            label="Preferred method"
            value={PAYMENT_LABELS[user?.preferredPaymentMethod] || '-'}
          />
          <Pressable style={styles.walletHistoryRow} onPress={() => setWalletOpen(true)}>
            <Text style={styles.walletHistoryText}>Transaction history</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Section>

        <Section title="Saved places">
          {addresses.map((a, i) => (
            <Pressable
              key={a._id || a.label}
              style={[
                styles.savedRow,
                i === addresses.length - 1 && styles.rowLast,
              ]}
              onPress={() => setModal({ type: 'edit-address', data: a })}
            >
              <View style={styles.savedIcon}>
                <Ionicons
                  name={
                    a.label === 'home'
                      ? 'home'
                      : a.label === 'work'
                      ? 'briefcase'
                      : 'location'
                  }
                  size={16}
                  color={colors.primaryDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedLabel}>
                  {a.label.charAt(0).toUpperCase() + a.label.slice(1)}
                </Text>
                <Text style={styles.savedAddress} numberOfLines={1}>
                  {a.address}
                </Text>
              </View>
              <Text style={styles.savedAction}>Edit</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.addAddressBtn}
            onPress={() => setModal({ type: 'add-address' })}
          >
            <Ionicons name="add-circle" size={18} color={colors.primary} />
            <Text style={styles.addAddressText}>Add a place</Text>
          </Pressable>
        </Section>

        {isDriver && (
          <>
            <Section title="Driver status">
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Online</Text>
                  <Text style={styles.toggleHint}>
                    Receive ride requests from nearby passengers.
                  </Text>
                </View>
                <Switch
                  value={online}
                  onValueChange={toggleOnline}
                  thumbColor="#ffffff"
                  activeThumbColor="#ffffff"
                  trackColor={{ false: colors.border, true: colors.primary }}
                  disabled={driverProfile?.isOnRide}
                />
              </View>
              <Row
                label="Verification"
                value={driverProfile?.status || 'pending'}
                badge={driverProfile?.status || 'pending'}
                badgeTone={driverProfile?.status === 'approved' ? 'good' : 'warn'}
              />
              <Row
                label="On a ride"
                value={driverProfile?.isOnRide ? 'Yes' : 'No'}
                last
              />
            </Section>

            <Section title="Vehicle" collapsible defaultOpen={false}>
              <Row label="Type" value={driverProfile?.vehicleType || '-'} />
              <Row label="Model" value={driverProfile?.vehicleModel || '-'} />
              <Row label="Colour" value={driverProfile?.vehicleColor || '-'} />
              <Row label="Year" value={driverProfile?.vehicleYear ? String(driverProfile.vehicleYear) : '-'} />
              <Row label="Plate" value={driverProfile?.vehiclePlate || '-'} last />
            </Section>

            <Section title="Driving stats" collapsible defaultOpen={false}>
              <View style={styles.metricsGrid}>
                <Metric label="Total rides" value={String(driverProfile?.totalRides ?? 0)} />
                <Metric label="Earnings" value={`Rs ${(driverProfile?.earnings ?? 0).toLocaleString()}`} />
                <Metric label="Rating" value={`${(driverProfile?.rating?.average ?? 0).toFixed(2)} / 5`} />
                <Metric label="Status" value={driverProfile?.status || '-'} />
              </View>
            </Section>
          </>
        )}

        {/* "Push notifications" / "Ride reminders" switches used to live here.
            Nothing stored them (no backend setting), so they were removed
            rather than shown as settings that do nothing. */}

        <Section title="Help & safety">
          <View style={styles.safetyRow}>
            {/* Passengers reach Support from the bottom nav tab; drivers (no tab bar) keep it here. */}
            {onSwitchToPassenger && (
              <Pressable style={styles.supportBtn} onPress={() => setHelpView('support')}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
                <Text style={styles.supportBtnText}>Support</Text>
              </Pressable>
            )}
            <Pressable style={styles.sosBtn} onPress={triggerSOS} disabled={sosBusy}>
              <Ionicons name="warning" size={20} color="#fff" />
              <Text style={styles.sosBtnText}>{sosBusy ? 'Sending…' : 'Emergency SOS'}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="Security & support">
          <LinkRow
            label="Change password"
            onPress={() => setModal({ type: 'password' })}
          />
          {/* "Two-factor authentication" and "Linked devices" lived here as
              local-only toggles; the backend has neither, so they promised
              protection that didn't exist. Bring them back with real APIs. */}
          <LinkRow
            label="Help centre"
            onPress={() => setModal({ type: 'help' })}
            last={!onSwitchToPassenger}
          />
          {onSwitchToPassenger && (
            <LinkRow
              label="Contact support"
              onPress={() => setHelpView('support')}
              last
            />
          )}
        </Section>

        <Section title="About">
          <Row label="Last login" value={formatDateTime(user?.lastLoginAt)} />
          <Row label="App version" value="1.0.0 (beta)" />
          {/* Required by the photo's CC BY-SA 4.0 licence. */}
          <Pressable
            style={styles.creditRow}
            onPress={() => Linking.openURL(SAFA_PHOTO_URL).catch(() => {})}
          >
            <Text style={styles.creditTitle}>Photo credits</Text>
            <Text style={styles.creditText}>
              "Safa Tempo, Kathmandu, Nepal" by (WT-shared) Shoestring at wts wikivoyage,
              CC BY-SA 4.0. Background removed, plate blurred.
            </Text>
          </Pressable>
        </Section>

        <Pressable style={styles.signOutBtn} onPress={async () => { await logout(); onSignOut(); }}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.footer}>Tempu, Kathmandu</Text>
      </ScrollView>

      <ProfileModal
        modal={modal}
        close={closeModal}
        profile={profile}
        setProfile={setProfile}
        updateAddress={updateAddress}
        addAddress={addAddress}
        removeAddress={removeAddress}
        walletTopup={walletTopup}
        sendSOS={sendSOS}
        sosBusy={sosBusy}
      />

      {walletOpen && (
        <View style={styles.overlay}>
          <WalletScreen
            onBack={() => setWalletOpen(false)}
            onTopup={() => setModal({ type: 'topup' })}
            refreshKey={walletRefresh}
            underAppBar={!!hideTitle}
          />
        </View>
      )}

      {helpView === 'support' && (
        <View style={styles.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <SupportScreen onBack={() => setHelpView(null)} role={onSwitchToPassenger ? 'driver' : 'passenger'} />
          </SafeAreaView>
        </View>
      )}

      {driverOverlay === 'vehicle' && (
        <View style={styles.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <DriverVehicleScreen
              onSuccess={async () => {
                setDriverStatus('pending');
                setDriverOverlay('pending');
              }}
              onBack={() => setDriverOverlay(null)}
            />
          </SafeAreaView>
        </View>
      )}

      {driverOverlay === 'pending' && (
        <View style={styles.overlay}>
          <SafeAreaView style={styles.pendingRoot}>
            <View style={styles.pendingInner}>
              <View style={styles.pendingIconWrap}>
                <Ionicons name="checkmark" size={36} color={colors.success} />
              </View>
              <Text style={styles.pendingTitle}>Application sent</Text>
              <Text style={styles.pendingSub}>
                We'll check your vehicle and licence details, usually within 24 hours,
                and notify you when it's approved.
              </Text>
              <Pressable style={styles.pendingBtn} onPress={() => setDriverOverlay(null)}>
                <Text style={styles.pendingBtnText}>Done</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

function ProfileModal({
  modal,
  close,
  profile,
  setProfile,
  updateAddress,
  addAddress,
  removeAddress,
  walletTopup,
  sendSOS,
  sosBusy,
}) {
  return (
    <Modal
      visible={!!modal}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.modalDismiss} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          {modal?.type === 'edit-profile' && (
            <EditProfileForm
              profile={profile}
              setProfile={setProfile}
              close={close}
            />
          )}
          {modal?.type === 'topup' && (
            <TopupForm topup={walletTopup} close={close} />
          )}
          {modal?.type === 'edit-address' && (
            <EditAddressForm
              address={modal.data}
              updateAddress={updateAddress}
              removeAddress={removeAddress}
              close={close}
            />
          )}
          {modal?.type === 'add-address' && (
            <AddAddressForm addAddress={addAddress} close={close} />
          )}
          {modal?.type === 'password' && <PasswordForm close={close} onSignOut={onSignOut} />}
          {modal?.type === 'help' && <HelpCentre close={close} />}
          {modal?.type === 'contact' && <ContactSupport close={close} />}
          {modal?.type === 'sos' && <SosForm onSend={sendSOS} busy={sosBusy} close={close} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalHeader({ title, close }) {
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <Pressable onPress={close} hitSlop={8} style={styles.modalClose}>
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

function FormField({ label, value, onChangeText, keyboardType, secure, editable = true }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.formInput}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize="none"
        editable={editable}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.primaryBtn, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function SosForm({ onSend, busy, close }) {
  const [note, setNote] = useState('');
  return (
    <>
      <ModalHeader title="Emergency SOS" close={close} />
      <Text style={styles.sosWarn}>
        This immediately shares your live location with the Tempu safety team.
      </Text>
      <View style={styles.formField}>
        <Text style={styles.formLabel}>Add a note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={[styles.formInput, styles.sosNoteInput]}
          placeholder="What's happening? Anything that helps us respond - leave blank if you can't."
          placeholderTextColor={colors.textFaint}
          multiline
          onKeyPress={sendShortcut(() => !busy && onSend(note))}
        />
      </View>
      <Pressable
        style={[styles.sosSendBtn, busy && { opacity: 0.6 }]}
        onPress={() => onSend(note)}
        disabled={busy}
      >
        <Ionicons name="alert-circle" size={18} color="#fff" />
        <Text style={styles.sosBtnText}>{busy ? 'Sending…' : 'Send SOS'}</Text>
      </Pressable>
    </>
  );
}

function EditProfileForm({ profile, setProfile, close }) {
  const { refreshUser } = useAuth();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <ModalHeader title="Edit profile" close={close} />
      <FormField label="Full name" value={name} onChangeText={setName} />
      {/* The server doesn't change phone numbers here (it's the login id and
          needs OTP verification), so don't pretend it saved one. */}
      <FormField label="Phone" value={profile.phone} editable={false} />
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <PrimaryButton
        label={saving ? 'Saving…' : 'Save changes'}
        disabled={saving}
        onPress={async () => {
          setSaving(true);
          try {
            const res = await userApi.updateProfile({ name, email });
            const saved = res?.data || {};
            setProfile((p) => ({ ...p, name: saved.name ?? p.name, email: saved.email ?? p.email }));
            refreshUser?.().catch(() => {});
            close();
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not save profile.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </>
  );
}

function TopupForm({ topup, close }) {
  const [amount, setAmount] = useState('500');
  const methods = usePaymentMethods();
  const [method, setMethod] = useState('esewa');
  const presets = [200, 500, 1000, 2000];
  const saving = topup.starting;
  return (
    <>
      <ModalHeader title="Top up wallet" close={close} />
      <View style={styles.presetRow}>
        {presets.map((p) => (
          <Pressable
            key={p}
            onPress={() => setAmount(String(p))}
            style={[styles.presetChip, Number(amount) === p && styles.presetChipActive]}
          >
            <Text style={[styles.presetText, Number(amount) === p && styles.presetTextActive]}>
              Rs {p}
            </Text>
          </Pressable>
        ))}
      </View>
      <FormField
        label="Custom amount"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
      />
      <Text style={styles.formLabel}>Pay with</Text>
      <PaymentMethodPicker methods={methods} value={method} onChange={setMethod} />
      <PrimaryButton
        label={saving ? 'Opening payment…' : `Pay Rs ${amount || 0}`}
        disabled={saving}
        onPress={async () => {
          const num = Number(amount);
          if (!Number.isInteger(num) || num < 10) {
            Alert.alert('Invalid amount', 'Enter at least Rs 10.');
            return;
          }
          if (await topup.start({ amount: num, method })) close();
        }}
      />
      <Text style={[styles.formCopy, { marginTop: 10 }]}>
        You'll finish paying in {method === 'khalti' ? 'Khalti' : 'eSewa'}. Your balance updates once the payment is confirmed.
      </Text>
    </>
  );
}

function SetOnMapButton({ onPress }) {
  return (
    <Pressable
      style={styles.setOnMapBtn}
      onPress={() => {
        hapticConfirm();
        onPress?.();
      }}
    >
      <Ionicons name="map" size={16} color="#5c6fff" />
      <Text style={styles.setOnMapText}>Set on map</Text>
    </Pressable>
  );
}

// The map picker hands back { address, coords }; a typed address has no point
// yet, so look it up (the backend needs one to save the place).
async function pointFor(address, picked) {
  if (picked) return picked;
  try {
    const [hit] = await Location.geocodeAsync(address);
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch {
    return null;
  }
}

function EditAddressForm({ address, updateAddress, removeAddress, close }) {
  const [value, setValue] = useState(address.address || '');
  const [coords, setCoords] = useState(null);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <ModalHeader title={`Edit ${address.label}`} close={close} />
      <FormField label="Address" value={value} onChangeText={setValue} />
      <SetOnMapButton onPress={() => setPicker(true)} />
      <PrimaryButton
        label={saving ? 'Saving…' : 'Save'}
        onPress={async () => {
          if (!value.trim()) return;
          setSaving(true);
          const data = { address: value.trim() };
          // Only move the pin if they picked one or changed the text.
          const point = coords || (value.trim() !== address.address ? await pointFor(value.trim(), null) : null);
          if (point) data.coordinates = point;
          await updateAddress(address._id, data);
          setSaving(false);
          close();
        }}
      />
      <Pressable
        style={styles.dangerBtn}
        onPress={async () => {
          await removeAddress(address._id);
          close();
        }}
      >
        <Text style={styles.dangerBtnText}>Remove place</Text>
      </Pressable>
      <MapPicker
        visible={picker}
        title={`Pin ${address.label}`}
        onCancel={() => setPicker(false)}
        onConfirm={({ address: picked, coords: c }) => { setValue(picked); setCoords(c); setPicker(false); }}
      />
    </>
  );
}

function AddAddressForm({ addAddress, close }) {
  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <ModalHeader title="Add a place" close={close} />
      <FormField label="Label (e.g. Gym)" value={label} onChangeText={setLabel} />
      <FormField label="Address" value={addr} onChangeText={(v) => { setAddr(v); setCoords(null); }} />
      <SetOnMapButton onPress={() => setPicker(true)} />
      {!!error && <Text style={styles.formError}>{error}</Text>}
      <PrimaryButton
        label={saving ? 'Adding…' : 'Add place'}
        onPress={async () => {
          setError('');
          if (!label.trim() || !addr.trim()) { setError('Enter a label and an address.'); return; }
          setSaving(true);
          const point = await pointFor(addr.trim(), coords);
          if (!point) {
            setSaving(false);
            setError("Couldn't find that address. Use \"Set on map\" to drop a pin.");
            return;
          }
          const ok = await addAddress(label.trim().toLowerCase(), addr.trim(), point);
          setSaving(false);
          if (ok) close();
          else setError('Could not save this place. Please try again.');
        }}
      />
      <MapPicker
        visible={picker}
        title="Pin location"
        onCancel={() => setPicker(false)}
        onConfirm={({ address: picked, coords: c }) => { setAddr(picked); setCoords(c); setPicker(false); }}
      />
    </>
  );
}

function PasswordForm({ close, onSignOut }) {
  const { logout } = useAuth();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <>
      <ModalHeader title="Change password" close={close} />
      <FormField label="Current password" value={oldPwd} onChangeText={setOldPwd} secure />
      <FormField label="New password" value={newPwd} onChangeText={setNewPwd} secure />
      <FormField label="Confirm new password" value={confirm} onChangeText={setConfirm} secure />
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <PrimaryButton
        label={saving ? 'Updating…' : 'Update password'}
        disabled={saving}
        onPress={async () => {
          if (newPwd.length < 8) { setError('Password must be at least 8 characters.'); return; }
          if (newPwd !== confirm) { setError('Passwords do not match.'); return; }
          setSaving(true);
          try {
            // Backend reads currentPassword (oldPassword always got a 400).
            await userApi.changePassword({ currentPassword: oldPwd, newPassword: newPwd, confirmPassword: confirm });
            // The server revokes the refresh token on a password change, so the
            // session can't be renewed — sign in again with the new password.
            close();
            Alert.alert('Password updated', 'Please sign in again with your new password.');
            await logout();
            onSignOut?.();
          } catch (err) {
            setError(err.message || 'Could not update password.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </>
  );
}



function HelpCentre({ close }) {
  const topics = [
    'I was charged the wrong amount',
    'My driver did not arrive',
    'How does bidding work?',
    'Update payment method',
    'Subscription billing questions',
  ];
  return (
    <>
      <ModalHeader title="Help centre" close={close} />
      {topics.map((t) => (
        <Pressable key={t} style={styles.helpRow}>
          <Text style={styles.helpText}>{t}</Text>
          <ChevronIcon dir="right" size={14} color={colors.textFaint} />
        </Pressable>
      ))}
    </>
  );
}

function ContactSupport({ close }) {
  return (
    <>
      <ModalHeader title="Contact support" close={close} />
      <Text style={styles.formCopy}>
        Our team usually replies within 30 minutes.
      </Text>
      <Pressable style={styles.contactRow}>
        <Ionicons name="call" size={20} color={colors.primary} />
        <Text style={styles.contactLabel}>Call 16600-12345</Text>
      </Pressable>
      <Pressable style={styles.contactRow}>
        <Ionicons name="mail" size={20} color="#5c6fff" />
        <Text style={styles.contactLabel}>support@tempu.com</Text>
      </Pressable>
      <Pressable style={styles.contactRow}>
        <Ionicons name="chatbubbles" size={20} color="#c98a2a" />
        <Text style={styles.contactLabel}>Start a live chat</Text>
      </Pressable>
      <PrimaryButton label="Close" onPress={close} />
    </>
  );
}

const THEME_OPTIONS = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  // Dark mode is disabled for now - it needs a redesign. Re-add this option and
  // restore the dark branch in themeStore.resolveScheme() to bring it back.
];

function ThemePicker() {
  const [mode, setMode] = useState(getThemeMode());
  const choose = (k) => {
    if (k === mode) return;
    setMode(k);
    setThemeMode(k);
    Alert.alert('Theme updated', 'The app will restart to apply your new theme.', [
      { text: 'Later' },
      { text: 'Apply now', onPress: () => reloadApp() },
    ]);
  };
  return (
    <View style={styles.themeRow}>
      {THEME_OPTIONS.map((o) => {
        const active = mode === o.key;
        return (
          <Pressable key={o.key} onPress={() => choose(o.key)} style={[styles.themeOpt, active && styles.themeOptActive]}>
            <Ionicons name={o.icon} size={20} color={active ? colors.primary : colors.textMuted} />
            <Text style={[styles.themeOptText, active && { color: colors.primary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, children, collapsible, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionBody}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeaderToggle}
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <ChevronIcon dir={open ? 'up' : 'down'} size={16} color={colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function Row({ label, value, badge, badgeTone, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
        {badge ? (
          <View
            style={[
              styles.badge,
              badgeTone === 'good' && styles.badgeGood,
              badgeTone === 'warn' && styles.badgeWarn,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                badgeTone === 'good' && styles.badgeTextGood,
                badgeTone === 'warn' && styles.badgeTextWarn,
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LinkRow({ label, last, onPress, badge }) {
  return (
    <Pressable
      style={[styles.linkRow, last && styles.rowLast]}
      onPress={onPress}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <View style={styles.linkRight}>
        {badge ? (
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <ChevronIcon dir="right" size={14} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

function Stat({ value, label, onPress, last }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap style={[styles.statCard, last && { borderRightWidth: 0 }]} onPress={onPress}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </Wrap>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const SAFA_PHOTO_URL = 'https://commons.wikimedia.org/wiki/File:Safa_Tempo,_Kathmandu,_Nepal.JPG';

const styles = StyleSheet.create({
  creditRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  creditTitle: { fontSize: 14, fontFamily: fonts.bodySemibold, color: colors.text, marginBottom: 2 },
  creditText: { fontSize: 12, lineHeight: 17, fontFamily: fonts.body, color: colors.textMuted, textDecorationLine: 'underline' },
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingTop: Platform.OS === 'android' ? 28 : 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerTitleWrap: {
    // match the header's own vertical padding so the title stays level
    // with the buttons
    position: 'absolute',
    left: 0,
    right: 0,
    top: Platform.OS === 'android' ? 28 : 16,
    bottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    letterSpacing: -0.3,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  editText: { color: colors.primaryDark, fontSize: 13, fontFamily: fonts.bodyBold },

  scroll: { paddingBottom: 40 },

  // Plain header: avatar left, name + phone beside it. No decoration.
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroText: { flex: 1, minWidth: 0 },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: fonts.displayBold,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.displayBold,
  },
  heroSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modeToggle: {
    flexDirection: 'row',
    marginTop: 16,
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePillText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  statusInactive: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotActive: { backgroundColor: colors.accent },
  statusDotInactive: { backgroundColor: colors.danger },
  statusPillText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.bodySemibold,
    textTransform: 'capitalize',
  },

  // One flat strip of numbers with dividers instead of four icon tiles.
  statsGrid: {
    marginHorizontal: 20,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.body,
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    marginBottom: 8,
  },
  sectionHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingRight: 4,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '65%',
  },
  rowValue: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  badgeGood: { backgroundColor: colors.surfaceMuted },
  badgeWarn: { backgroundColor: colors.primarySoft },
  badgeText: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.textMuted },
  badgeTextGood: { color: colors.primaryDark },
  badgeTextWarn: { color: colors.warn },

  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  walletLabel: {
    color: colors.primaryDark,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },
  walletAmount: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.displayBold,
    marginTop: 4,
  },
  topUpBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  topUpText: { color: '#ffffff', fontSize: 13, fontFamily: fonts.bodyBold },

  subCard: {
    padding: 14,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subPlan: { color: colors.text, fontSize: 16, fontFamily: fonts.bodyBold },
  subPrice: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body, marginTop: 6 },
  subRenews: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.body, marginTop: 4 },
  subManage: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  subManageText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemibold },

  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },
  savedAddress: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  savedAction: { color: colors.primary, fontSize: 13, fontFamily: fonts.bodySemibold },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  addAddressText: { color: colors.primary, fontSize: 14, fontFamily: fonts.bodyBold },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },
  toggleHint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginTop: 2 },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  metric: {
    width: '47%',
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricValue: { color: colors.primary, fontSize: 18, fontFamily: fonts.bodyBold },
  metricLabel: { color: colors.textMuted, fontSize: 12, marginTop: 3, fontFamily: fonts.bodySemibold },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docIcon: {
    width: 30,
    height: 38,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },
  docState: { fontSize: 12, marginTop: 2, fontFamily: fonts.bodySemibold },
  docStateGood: { color: colors.primaryDark },
  docStateWarn: { color: colors.warn },
  docAction: { color: colors.primary, fontSize: 13, fontFamily: fonts.bodySemibold },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.body },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: colors.textFaint,
    transform: [{ rotate: '45deg' }],
  },

  signOutBtn: {
    marginTop: spacing.xxl,
    marginHorizontal: 20,
    paddingVertical: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
  },
  signOutText: { color: colors.danger, fontSize: 15, fontFamily: fonts.bodyBold },

  safetyRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  themeRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  themeOpt: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.xl,
  },
  themeOptActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  themeOptText: { ...type.caption, color: colors.textMuted },
  supportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: spacing.lg,
  },
  supportBtnText: { color: colors.primary, fontSize: 14, fontFamily: fonts.bodyBold },
  sosBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.lg,
  },
  sosBtnText: { color: '#fff', fontSize: 14, fontFamily: fonts.bodyBold },
  sosWarn: { ...type.body, color: colors.textMuted, marginBottom: 14 },
  sosNoteInput: { height: 92, paddingTop: 12, textAlignVertical: 'top' },
  sosSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },

  linkRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  linkBadgeText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bodyBold },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  formField: { marginBottom: 12 },
  formLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formError: { color: colors.danger, fontSize: 12, fontFamily: fonts.body, marginTop: -4, marginBottom: 8 },
  formCopy: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.body,
    lineHeight: 19,
    marginBottom: 12,
  },

  primaryBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontFamily: fonts.bodyBold },
  dangerBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  dangerBtnText: { color: colors.danger, fontSize: 14, fontFamily: fonts.bodyBold },

  setOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  setOnMapText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  presetChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  presetText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyBold },
  presetTextActive: { color: colors.primaryDark },

  docPreview: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 14,
    gap: 10,
  },
  docPreviewText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  docStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },



  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  helpText: { color: colors.text, fontSize: 14, fontFamily: fonts.body, flex: 1 },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 8,
  },
  contactLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },
  footer: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 18,
  },

  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverBadgeText: { color: colors.primary, fontSize: 12, fontFamily: fonts.bodyBold },

  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1.5,
    borderColor: colors.warn,
  },
  rejectedBanner: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  reviewBannerTitle: {
    color: colors.warn,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    marginBottom: 3,
  },
  reviewBannerSub: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.body,
    lineHeight: 18,
  },

  switchModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  switchModeCardAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  switchModeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  switchModeTitle: { color: '#fff', fontSize: 15, fontFamily: fonts.bodyBold },
  switchModeSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  switchModeTitleAlt: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodyBold },
  switchModeSubAlt: { color: colors.primaryDark, fontSize: 12, fontFamily: fonts.body, marginTop: 2, opacity: 0.8 },

  becomeDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  becomeDriverLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  becomeDriverImg: { width: 44, height: 44 },
  becomeDriverTitle: { color: colors.primary, fontSize: 15, fontFamily: fonts.bodyBold },
  becomeDriverSub: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body, marginTop: 2 },

  // Same box as Row (the row above keeps its bottom divider).
  walletHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  walletHistoryText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemibold },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    backgroundColor: colors.background,
  },

  pendingRoot: { flex: 1 },
  pendingInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  pendingIconEmoji: { fontSize: 40, fontFamily: fonts.body },
  pendingTitle: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.display,
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 36,
  },
  pendingBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  pendingBtnText: { color: '#ffffff', fontSize: 16, fontFamily: fonts.bodyBold },
});
