import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CallIcon } from '../components/Icons';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import { radius, spacing, type, shadow } from '../theme';

const NOTIFICATION_META = {
  trip_request: { lib: 'ion', name: 'car', color: colors.primary, bg: colors.primarySoft },
  bid_received: { lib: 'ion', name: 'pricetag', color: colors.text, bg: colors.surfaceMuted },
  bid_accepted: { lib: 'ion', name: 'checkmark-circle', color: colors.primary, bg: colors.primarySoft },
  driver_arriving: { lib: 'ion', name: 'location', color: colors.danger, bg: colors.dangerSoft },
  trip_started: { lib: 'mci', name: 'road-variant', color: colors.text, bg: colors.surfaceMuted },
  trip_completed: { lib: 'ion', name: 'flag', color: colors.primary, bg: colors.primarySoft },
  trip_cancelled: { lib: 'ion', name: 'close-circle', color: colors.danger, bg: colors.dangerSoft },
  subscription_alert: { lib: 'mci', name: 'school', color: colors.warn, bg: colors.warnSoft },
  document_verified: { lib: 'ion', name: 'shield-checkmark', color: colors.primary, bg: colors.primarySoft },
  document_rejected: { lib: 'ion', name: 'warning', color: colors.warn, bg: colors.warnSoft },
  payment: { lib: 'ion', name: 'wallet', color: colors.warn, bg: colors.warnSoft },
  account_approved: { lib: 'ion', name: 'checkmark-circle', color: colors.primary, bg: colors.primarySoft },
  account_suspended: { lib: 'ion', name: 'ban', color: colors.danger, bg: colors.dangerSoft },
  account_rejected: { lib: 'ion', name: 'close-circle', color: colors.danger, bg: colors.dangerSoft },
  general: { lib: 'ion', name: 'notifications', color: colors.text, bg: colors.surfaceMuted },
};

function NotificationIcon({ type }) {
  const m = NOTIFICATION_META[type] || NOTIFICATION_META.general;
  const Lib = m.lib === 'mci' ? MaterialCommunityIcons : Ionicons;
  return <Lib name={m.name} size={18} color={m.color} />;
}

const TABS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'messages', label: 'Messages' },
];

function timeAgo(value) {
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function InboxScreen() {
  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await userApi.getNotifications();
      setNotifications(res.data?.notifications || res.data || []);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markRead = async (id) => {
    try {
      await userApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <Text style={styles.headerSubtitle}>Your alerts and trip updates</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {tab === 'notifications' && (
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : notifications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={26} color={colors.textFaint} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.empty}>Your trip alerts and updates will appear here.</Text>
            </View>
          ) : (
            notifications.map((n) => {
              const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.general;
              return (
                <Pressable
                  key={n._id}
                  onPress={() => !n.isRead && markRead(n._id)}
                  style={[styles.notifRow, !n.isRead && styles.notifUnread]}
                >
                  {!n.isRead && <View style={styles.notifUnreadBar} />}
                  <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                    <NotificationIcon type={n.type} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifTopRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                      <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
                    </View>
                    <Text style={styles.notifBody}>{n.body}</Text>
                  </View>
                  {!n.isRead && <View style={styles.notifUnreadDot} />}
                </Pressable>
              );
            })
          )
        )}

        {tab === 'messages' && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>No messages</Text>
            <Text style={styles.empty}>In-trip chat available during active rides.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xs },
  headerTitle: { ...type.display, color: colors.text },
  headerSubtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.caption, color: colors.textMuted },
  tabTextActive: { color: '#ffffff' },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl + spacing.xs },

  emptyWrap: { alignItems: 'center', marginTop: spacing.xxxl + spacing.lg, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.h3, color: colors.text, marginBottom: spacing.xs },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  notifUnread: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  notifUnreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifUnreadDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.primary, marginLeft: spacing.xs },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  notifTitle: { ...type.bodyBold, color: colors.text, flex: 1 },
  notifTime: { ...type.micro, color: colors.textFaint },
  notifBody: { ...type.body, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
});
