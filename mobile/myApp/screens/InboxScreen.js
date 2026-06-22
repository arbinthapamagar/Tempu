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

const NOTIFICATION_META = {
  trip_request: { lib: 'ion', name: 'car', color: '#1f242b', bg: '#fff2e8' },
  bid_received: { lib: 'ion', name: 'pricetag', color: '#5c6fff', bg: '#eaecff' },
  bid_accepted: { lib: 'ion', name: 'checkmark-circle', color: '#1f242b', bg: '#fff2e8' },
  driver_arriving: { lib: 'ion', name: 'location', color: '#e0464a', bg: '#fbecec' },
  trip_started: { lib: 'mci', name: 'road-variant', color: '#5c6fff', bg: '#eaecff' },
  trip_completed: { lib: 'ion', name: 'flag', color: '#1f242b', bg: '#fff2e8' },
  trip_cancelled: { lib: 'ion', name: 'close-circle', color: '#c43d3d', bg: '#fbecec' },
  subscription_alert: { lib: 'mci', name: 'school', color: '#c98a2a', bg: '#fbf1de' },
  document_verified: { lib: 'ion', name: 'shield-checkmark', color: '#1f242b', bg: '#fff2e8' },
  document_rejected: { lib: 'ion', name: 'warning', color: '#c98a2a', bg: '#fbf1de' },
  payment: { lib: 'ion', name: 'wallet', color: '#c98a2a', bg: '#fbf1de' },
  account_approved: { lib: 'ion', name: 'checkmark-circle', color: '#1f242b', bg: '#fff2e8' },
  account_suspended: { lib: 'ion', name: 'ban', color: '#c43d3d', bg: '#fbecec' },
  account_rejected: { lib: 'ion', name: 'close-circle', color: '#c43d3d', bg: '#fbecec' },
  general: { lib: 'ion', name: 'notifications', color: '#5c6fff', bg: '#eaecff' },
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
            <Text style={styles.empty}>No notifications yet.</Text>
          ) : (
            notifications.map((n) => {
              const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.general;
              return (
                <Pressable
                  key={n._id}
                  onPress={() => !n.isRead && markRead(n._id)}
                  style={[styles.notifRow, !n.isRead && styles.notifUnread]}
                >
                  <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                    <NotificationIcon type={n.type} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifTopRow}>
                      <Text style={styles.notifTitle}>{n.title}</Text>
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
          <Text style={styles.empty}>In-trip chat available during active rides.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },

  scroll: { paddingHorizontal: 20, paddingBottom: 28 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 36, fontSize: 14 },

  notifRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  notifUnread: { backgroundColor: colors.primarySoft, borderColor: '#cfe6d8' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 4 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  notifTime: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  notifBody: { color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
