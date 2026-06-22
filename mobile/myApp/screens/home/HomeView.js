import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VehiclePhoto } from '../../components/Brand';
import { pick as hapticPick } from '../../components/haptics';
import { ChevronIcon, SearchIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, shadow, spacing, STATUS_TOP_PAD, type } from '../../theme';
import BrandLogo from './BrandLogo';
import Map from './Map';
import { HOME_REFRESH_MS } from './constants';

const SERVICES = [
  { id: 'rickshaw', label: 'Rickshaw', sub: 'Local', type: 'tuktuk' },
  { id: 'scooter', label: 'EV Scooter', sub: 'Eco', type: 'scooter' },
  { id: 'delivery', label: 'Delivery', sub: 'Parcels', type: 'tuktuk_delivery' },
  { id: 'subscribe', label: 'Subscribe', sub: 'Daily', type: 'bike' },
];

const SAVED_PLACE_ICON = {
  home: 'home',
  work: 'briefcase',
};

function savedPlaceIcon(label) {
  return SAVED_PLACE_ICON[label] || 'location';
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HomeView({ onTapSearch, onPickSaved }) {
  const { user } = useAuth();
  const savedAddresses = user?.savedAddresses || [];
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState('rickshaw');

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), HOME_REFRESH_MS);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <BrandLogo />
        <View style={styles.headerRight}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Live</Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Map — rounded "floating" band */}
        <View style={styles.mapBand}>
          <Map step="home" />
        </View>

        {/* Prominent "Where to?" search card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Where to?</Text>
          <Text style={styles.searchSub}>Your next journey awaits.</Text>
          <Pressable style={styles.searchPill} onPress={onTapSearch}>
            <SearchIcon size={20} color={colors.primary} />
            <Text style={styles.searchPillText}>Search for a destination</Text>
          </Pressable>

          {/* Quick destination pills from saved places */}
          {savedAddresses.length > 0 && (
            <View style={styles.quickRow}>
              {savedAddresses.slice(0, 3).map((s) => (
                <Pressable
                  key={s.label}
                  style={styles.quickPill}
                  onPress={() => {
                    hapticPick();
                    onPickSaved(s.address);
                  }}
                >
                  <Ionicons
                    name={savedPlaceIcon(s.label)}
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.quickPillText}>{titleCase(s.label)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Ride options — rounded tiles */}
        <Text style={styles.sectionTitle}>Ride options</Text>
        <View style={styles.serviceGrid}>
          {SERVICES.map((s) => {
            const active = s.id === selected;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelected(s.id)}
                style={[styles.serviceTile, active && styles.serviceTileActive]}
              >
                <VehiclePhoto type={s.type} size={44} />
                <Text style={styles.serviceTileLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={styles.serviceTileSub} numberOfLines={1}>
                  {s.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Saved places — bento grid of rounded cards */}
        <View style={styles.savedHeader}>
          <Text style={styles.sectionTitle}>Saved places</Text>
          <Pressable hitSlop={8}>
            <Text style={styles.savedSeeAll}>See all</Text>
          </Pressable>
        </View>

        {savedAddresses.length > 0 ? (
          <View style={styles.bentoGrid}>
            {savedAddresses.slice(0, 4).map((s) => (
              <Pressable
                key={s.label}
                style={styles.bentoCard}
                onPress={() => {
                  hapticPick();
                  onPickSaved(s.address);
                }}
              >
                <View style={styles.bentoIcon}>
                  <Ionicons
                    name={savedPlaceIcon(s.label)}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.bentoLabel}>{titleCase(s.label)}</Text>
                <Text style={styles.bentoAddress} numberOfLines={2}>
                  {s.address}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable style={styles.emptySaved} onPress={onTapSearch}>
            <View style={styles.bentoIcon}>
              <Ionicons name="add" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bentoLabel}>Add a place</Text>
              <Text style={styles.bentoAddress}>Save home & work for quick booking</Text>
            </View>
            <ChevronIcon dir="right" />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: Math.max(0, STATUS_TOP_PAD - 12),
    paddingBottom: spacing.xs + 2,
    backgroundColor: colors.background,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  body: { flex: 1, backgroundColor: colors.background },
  bodyContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + 8,
  },

  mapBand: {
    height: 180,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Prominent search card
  searchCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },
  searchTitle: { ...type.h2, color: colors.text },
  searchSub: { ...type.body, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md + 2 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 4,
  },
  searchPillText: { flex: 1, ...type.body, color: colors.textMuted, fontWeight: '500' },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPillText: { ...type.caption, color: colors.text, fontWeight: '700' },

  sectionTitle: { ...type.bodyBold, color: colors.text, marginTop: spacing.xl },

  serviceGrid: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  serviceTile: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceTileActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  serviceTileLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  serviceTileSub: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },

  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedSeeAll: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing.xl },

  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  bentoCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bentoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  bentoLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  bentoAddress: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  emptySaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
