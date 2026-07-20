import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, STATUS_TOP_PAD, type } from '../../theme';
import { userApi } from '../../api/user.api';
import InboxScreen from '../InboxScreen';
import ProfileScreen from '../ProfileScreen';
import SupportScreen from '../SupportScreen';
import DriverEarnings from './DriverEarnings';
import DriverHome from './DriverHome';
import useDriverFlow from './useDriverFlow';

const TABS = [
  { id: 'home', label: 'Drive', icon: 'car-sport' },
  { id: 'earnings', label: 'Earnings', icon: 'wallet' },
  { id: 'support', label: 'Support', icon: 'chatbubble-ellipses' },
  { id: 'account', label: 'Account', icon: 'person' },
];

function DriverTabBar({ active, onChange, locked }) {
  return (
    <View style={styles.tabbar}>
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            style={styles.tab}
            onPress={() => !locked && onChange(t.id)}
            hitSlop={6}
          >
            <Ionicons
              name={isActive ? t.icon : `${t.icon}-outline`}
              size={23}
              color={isActive ? colors.primary : (locked ? colors.textFaint : colors.textMuted)}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Always-visible driver status strip: shows they're in driving mode + total
// trips, with support and notifications reachable from the top-right anywhere.
function DriverTopBar({ online, totalRides, unread, onNotifications }) {
  return (
    <View style={styles.topbar}>
      <View style={styles.topbarLeft}>
        <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.textFaint }]} />
        <Text style={styles.topbarTitle}>Driving mode</Text>
        {totalRides != null && (
          <Text style={styles.topbarSub}>· {totalRides} trips</Text>
        )}
      </View>
      <View style={styles.topbarRight}>
        <Pressable style={styles.iconBtn} onPress={onNotifications} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function OverlayHeader({ title, onBack }) {
  return (
    <View style={styles.overlayHeader}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.overlayTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

/**
 * The full Driver Mode workspace. Owns the driver flow hook so online state,
 * nearby trips, and an in-progress trip persist while switching tabs. A shared
 * top bar keeps "driving mode", trip count, support and notifications available
 * on every driver screen.
 */
export default function DriverShell({ initialOnline, onSwitchToPassenger, onSignOut }) {
  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState(null); // 'support' | 'notifications' | null
  const [totalRides, setTotalRides] = useState(null);
  const [unread, setUnread] = useState(0);
  const flow = useDriverFlow(initialOnline);

  // Load the trip count + unread notification count for the top bar.
  useEffect(() => {
    userApi.getMyEarnings()
      .then((r) => setTotalRides(r.data?.totalRides ?? 0))
      .catch(() => {});
    userApi.getNotifications(1)
      .then((r) => {
        const items = r.data?.notifications || r.data || [];
        setUnread(items.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  }, []);

  const openNotifications = () => {
    setOverlay('notifications');
    setUnread(0);
    userApi.markAllNotificationsRead().catch(() => {});
  };

  // While driving an active trip, lock the tabs to the Drive screen.
  const drivingLocked = !!flow.activeTrip && flow.activeTrip.status !== 'completed';

  if (overlay === 'notifications') {
    return (
      <View style={styles.root}>
        <OverlayHeader title="Notifications" onBack={() => setOverlay(null)} />
        <View style={styles.body}><InboxScreen /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Support has its own header; every other tab gets the driving-mode strip. */}
      {tab !== 'support' && (
        <DriverTopBar
          online={flow.online}
          totalRides={totalRides}
          unread={unread}
          onNotifications={openNotifications}
        />
      )}
      <View style={styles.body}>
        {tab === 'home' && <DriverHome flow={flow} />}
        {tab === 'earnings' && <DriverEarnings />}
        {tab === 'support' && <SupportScreen role="driver" onBack={() => setTab('home')} />}
        {tab === 'account' && (
          <ProfileScreen
            onBack={() => setTab('home')}
            onSignOut={onSignOut}
            onSwitchToPassenger={onSwitchToPassenger}
          />
        )}
      </View>
      <DriverTabBar
        active={drivingLocked ? 'home' : tab}
        onChange={setTab}
        locked={drivingLocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },

  // Top status strip
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: STATUS_TOP_PAD + 4,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  topbarTitle: { ...type.bodyBold, color: colors.text },
  topbarSub: { ...type.caption, color: colors.textMuted },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 3,
    borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Overlay (support / notifications)
  overlayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: STATUS_TOP_PAD + 4, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  overlayTitle: { ...type.h2, color: colors.text },

  // Tab bar
  tabbar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  labelActive: { color: colors.primary, fontWeight: '700' },
});
