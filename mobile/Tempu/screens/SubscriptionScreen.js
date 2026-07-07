import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { userApi } from '../api/user.api';
import { colors } from '../theme/colors';
import { radius, spacing, type, shadow } from '../theme';

const PLAN_INFO = {
  parent: {
    name: 'Parent plan',
    tagline: 'Daily school runs for your child',
    features: [
      'Dedicated driver assigned',
      'Live trip tracking',
      'Monthly billing',
      'Backup driver support',
      'Missed day deductions',
    ],
    price: 5000,
    period: 'month',
  },
  business: {
    name: 'Business plan',
    tagline: 'Regular delivery or commute service',
    features: [
      'Flexible pickup times',
      'Goods or passenger transport',
      'Priority driver matching',
      'Invoice billing',
      'Dedicated support',
    ],
    price: 8000,
    period: 'month',
  },
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SubscriptionScreen({ onBack }) {
  const [tab, setTab] = useState('active');
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userApi.getMySubscriptions();
      setSubscriptions(res.data || []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const activeSubscription = subscriptions.find((s) => s.status === 'active' || s.status === 'paused');

  const handlePause = async (id) => {
    try {
      await userApi.pauseSubscription(id);
      setSubscriptions((prev) => prev.map((s) => s._id === id ? { ...s, status: 'paused' } : s));
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not pause subscription.');
    }
  };

  const handleResume = async (id) => {
    try {
      await userApi.resumeSubscription(id);
      setSubscriptions((prev) => prev.map((s) => s._id === id ? { ...s, status: 'active' } : s));
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not resume subscription.');
    }
  };

  const handleCancel = (id) => {
    Alert.alert('Cancel plan', 'Are you sure you want to cancel your subscription?', [
      { text: 'Keep plan', style: 'cancel' },
      {
        text: 'Cancel plan',
        style: 'destructive',
        onPress: async () => {
          try {
            await userApi.cancelSubscription(id);
            setSubscriptions((prev) => prev.map((s) => s._id === id ? { ...s, status: 'cancelled' } : s));
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not cancel subscription.');
          }
        },
      },
    ]);
  };

  const handleSubscribe = async (plan) => {
    Alert.alert('Coming soon', `${PLAN_INFO[plan]?.name} sign-up flow will be available soon.`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <View style={styles.backArrow} />
        </Pressable>
        <Text style={styles.headerTitle}>Subscriptions</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>My plan</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'browse' && styles.tabActive]} onPress={() => setTab('browse')}>
          <Text style={[styles.tabText, tab === 'browse' && styles.tabTextActive]}>Browse plans</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {tab === 'active' ? (
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : activeSubscription ? (
            <ActiveSubscription
              sub={activeSubscription}
              onPause={() => handlePause(activeSubscription._id)}
              onResume={() => handleResume(activeSubscription._id)}
              onCancel={() => handleCancel(activeSubscription._id)}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No active plan</Text>
              <Text style={styles.emptySub}>Browse plans below to get started.</Text>
              <Pressable style={styles.browseCta} onPress={() => setTab('browse')}>
                <Text style={styles.browseCtaText}>Browse plans</Text>
              </Pressable>
            </View>
          )
        ) : (
          Object.entries(PLAN_INFO).map(([id, plan]) => (
            <PlanCard key={id} plan={{ id, ...plan }} onSubscribe={() => handleSubscribe(id)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ActiveSubscription({ sub, onPause, onResume, onCancel }) {
  const info = PLAN_INFO[sub.plan] || {};
  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroPlanPill}>
            <Text style={styles.heroPlanPillText}>{info.tagline ? 'Active plan' : 'Subscription'}</Text>
          </View>
          <View style={styles.heroStatus}>
            <View style={styles.heroStatusDot} />
            <Text style={styles.heroStatusText}>{sub.status}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{info.name || sub.plan}</Text>
        {!!info.tagline && <Text style={styles.heroTagline}>{info.tagline}</Text>}
        <Text style={styles.heroPrice}>
          Rs {sub.monthlyPrice?.toLocaleString()} <Text style={styles.heroPer}>/ month</Text>
        </Text>
        <View style={styles.heroRenewsPill}>
          <Text style={styles.heroRenews}>Active until {formatDate(sub.endDate)}</Text>
        </View>
      </View>

      {sub.plan === 'parent' && sub.childName && (
        <>
          <Text style={styles.sectionTitle}>Child</Text>
          <View style={styles.card}>
            <Row label="Name" value={sub.childName} />
            {sub.childAge != null && <Row label="Age" value={`${sub.childAge} yrs`} />}
            {sub.schoolName && <Row label="School" value={sub.schoolName} last />}
          </View>
        </>
      )}

      {sub.plan === 'business' && sub.businessName && (
        <>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <Row label="Name" value={sub.businessName} />
            {sub.businessAddress && <Row label="Address" value={sub.businessAddress} />}
            {sub.goodsType && <Row label="Goods" value={sub.goodsType} last />}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Schedule</Text>
      <View style={styles.card}>
        <Row label="Pickup" value={`${sub.pickup?.address}${sub.pickupTime ? ` · ${sub.pickupTime}` : ''}`} />
        <Row label="Drop-off" value={`${sub.dropoff?.address}${sub.dropoffTime ? ` · ${sub.dropoffTime}` : ''}`} />
        <Row label="Vehicle" value={sub.vehicleType} last />
      </View>

      <Text style={styles.sectionTitle}>Billing</Text>
      <View style={styles.card}>
        <Row label="Started" value={formatDate(sub.startDate)} />
        <Row label="Missed days" value={String(sub.missedDays?.length ?? 0)} last />
      </View>

      {sub.status === 'paused' ? (
        <Pressable style={styles.pauseBtn} onPress={onResume}>
          <Text style={styles.pauseBtnText}>Resume subscription</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.pauseBtn} onPress={onPause}>
          <Text style={styles.pauseBtnText}>Pause subscription</Text>
        </Pressable>
      )}
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel plan</Text>
      </Pressable>
    </View>
  );
}

function PlanCard({ plan, onSubscribe }) {
  const short = plan.id === 'parent' ? 'PR' : 'BZ';
  return (
    <View style={styles.planCard}>
      <View style={styles.planBadge}>
        <Text style={styles.planBadgeText}>{short}</Text>
      </View>
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.planTag}>{plan.tagline}</Text>
      <Text style={styles.planPrice}>
        Rs {plan.price.toLocaleString()}<Text style={styles.planPer}> / {plan.period}</Text>
      </Text>
      <View style={styles.featureList}>
        {plan.features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.subscribeBtn} onPress={onSubscribe}>
        <Text style={styles.subscribeBtnText}>Subscribe</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.text, transform: [{ rotate: '45deg' }], marginLeft: 4 },
  headerTitle: { ...type.h2, color: colors.text },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.caption, color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl + spacing.sm, paddingTop: spacing.xs },

  emptyWrap: { alignItems: 'center', paddingTop: 72, paddingHorizontal: spacing.lg },
  emptyTitle: { ...type.h1, color: colors.text },
  emptySub: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  browseCta: { marginTop: spacing.xl, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md + 2, backgroundColor: colors.primary, borderRadius: radius.pill },
  browseCtaText: { ...type.bodyBold, color: '#fff' },

  heroCard: { backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.xl, marginBottom: spacing.xl, ...shadow.fab },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroPlanPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.20)' },
  heroPlanPillText: { ...type.eyebrow, color: '#fff' },
  heroStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.20)' },
  heroStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  heroStatusText: { ...type.micro, color: '#fff', textTransform: 'capitalize' },
  heroTitle: { ...type.display, color: '#fff', marginTop: spacing.lg },
  heroTagline: { ...type.body, color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs },
  heroPrice: { color: '#fff', fontSize: 32, fontFamily: type.display.fontFamily, marginTop: spacing.md, letterSpacing: -1 },
  heroPer: { fontSize: 14, fontFamily: type.bodyBold.fontFamily },
  heroRenewsPill: { alignSelf: 'flex-start', marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.18)' },
  heroRenews: { ...type.caption, color: '#fff' },

  sectionTitle: { ...type.eyebrow, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...type.small, color: colors.textMuted },
  rowValue: { ...type.bodyBold, color: colors.text, maxWidth: '60%', textTransform: 'capitalize' },

  pauseBtn: { marginTop: spacing.xxl, paddingVertical: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  pauseBtnText: { ...type.bodyBold, color: colors.text },
  cancelBtn: { marginTop: spacing.md, paddingVertical: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.dangerSoft, alignItems: 'center' },
  cancelBtnText: { ...type.bodyBold, color: colors.danger },

  planCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.xl, marginBottom: spacing.lg, ...shadow.card },
  planBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  planBadgeText: { ...type.micro, color: colors.primary },
  planName: { ...type.h1, color: colors.text },
  planTag: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
  planPrice: { color: colors.text, fontSize: 30, fontFamily: type.display.fontFamily, marginTop: spacing.md, letterSpacing: -0.5 },
  planPer: { ...type.caption, color: colors.textMuted },
  featureList: { marginTop: spacing.lg, gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureCheck: { color: colors.primary, fontSize: 12, fontFamily: type.bodyBold.fontFamily, width: 22, height: 22, lineHeight: 22, textAlign: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  featureText: { ...type.small, color: colors.text, flex: 1 },
  subscribeBtn: { marginTop: spacing.xl, paddingVertical: spacing.md + 2, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center' },
  subscribeBtnText: { ...type.bodyBold, color: '#fff' },
});
