import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { pick as hapticPick } from '../../components/haptics';
import { useAuth } from '../../context/AuthContext';
import { colors, STATUS_TOP_PAD } from '../../theme';
import { fonts } from '../../theme/type';
import Map from './Map';
import { HOME_REFRESH_MS } from './constants';

const SERVICES = [
  { id: 'rickshaw', label: 'Rickshaw', sub: 'Local', icon: 'rickshaw', lib: 'mci' },
  { id: 'scooter', label: 'Scooter', sub: 'Eco', icon: 'moped', lib: 'mci' },
  { id: 'delivery', label: 'Delivery', sub: 'Parcels', icon: 'package-variant-closed', lib: 'mci' },
  { id: 'subscribe', label: 'Subscribe', sub: 'Daily', icon: 'calendar-check', lib: 'mci', dark: true },
];

const SAVED_PLACE_ICON = { home: 'home', work: 'briefcase' };

function savedPlaceIcon(label) {
  return SAVED_PLACE_ICON[label] || 'location';
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ServiceIcon({ icon, lib, color }) {
  if (lib === 'mci') {
    return <MaterialCommunityIcons name={icon} size={28} color={color} />;
  }
  return <Ionicons name={icon} size={28} color={color} />;
}

export default function HomeView({ onTapSearch, onPickSaved }) {
  const { user } = useAuth();
  const savedAddresses = user?.savedAddresses || [];
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState('rickshaw');
  const initial = (user?.name || 'T').trim().charAt(0).toUpperCase();

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), HOME_REFRESH_MS);
  };

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
      <View style={styles.header}>
        <Image source={require('../../assets/logo-wordmark.png')} style={styles.brand} resizeMode="contain" />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
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
        {/* Map hero (full-bleed) */}
        <View style={styles.mapHero}>
          <Map step="home" />
        </View>

        {/* Floating "Where to?" pill overlapping the map */}
        <View style={styles.searchWrap}>
          <Pressable style={styles.searchPill} onPress={onTapSearch}>
            <Ionicons name="search" size={22} color={colors.primary} />
            <Text style={styles.searchPillText}>Where to?</Text>
            <View style={styles.nowChip}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.nowChipText}>Now</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {/* Services */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Services</Text>
          <Pressable hitSlop={8} onPress={onTapSearch} style={styles.seeAllRow}>
            <Text style={styles.seeAll}>See all</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceRow}
        >
          {SERVICES.map((s) => {
            const active = s.id === selected;
            const dark = s.dark;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  hapticPick();
                  setSelected(s.id);
                }}
                style={[
                  styles.serviceCard,
                  dark && styles.serviceCardDark,
                  active && !dark && styles.serviceCardActive,
                ]}
              >
                <View
                  style={[
                    styles.serviceIcon,
                    dark && styles.serviceIconDark,
                  ]}
                >
                  <ServiceIcon
                    icon={s.icon}
                    lib={s.lib}
                    color={dark ? '#ffffff' : colors.primary}
                  />
                </View>
                <Text style={[styles.serviceLabel, dark && styles.textOnDark]}>
                  {s.label}
                </Text>
                <Text style={[styles.serviceSub, dark && styles.subOnDark]}>
                  {s.sub}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Saved places */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 8 }]}>
          Saved Places
        </Text>
        <View style={styles.savedList}>
          {savedAddresses.slice(0, 3).map((s) => (
            <Pressable
              key={s.label}
              style={styles.savedRow}
              onPress={() => {
                hapticPick();
                onPickSaved(s.address);
              }}
            >
              <View style={styles.savedIcon}>
                <Ionicons name={savedPlaceIcon(s.label)} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedLabel}>{titleCase(s.label)}</Text>
                <Text style={styles.savedAddress} numberOfLines={1}>
                  {s.address}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}

          {/* Add new */}
          <Pressable style={styles.addRow} onPress={onTapSearch}>
            <View style={styles.addIcon}>
              <Ionicons name="add" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.addLabel}>Add new place</Text>
          </Pressable>
        </View>

        {/* Promo banner */}
        <View style={styles.promo}>
          <View style={styles.promoTextWrap}>
            <Text style={styles.promoTitle}>Switch to EV and save 20%</Text>
            <Pressable style={styles.promoBtn} onPress={onTapSearch}>
              <Text style={styles.promoBtnText}>Eco Now</Text>
            </Pressable>
          </View>
          <MaterialCommunityIcons
            name="moped-electric"
            size={96}
            color="rgba(255,255,255,0.15)"
            style={styles.promoArt}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 24,
  elevation: 2,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Math.max(0, STATUS_TOP_PAD - 8),
    backgroundColor: colors.surface,
    ...CARD_SHADOW,
    zIndex: 10,
  },
  brand: {
    height: 28,
    width: 74,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  avatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.primary,
  },

  body: { flex: 1, backgroundColor: colors.background },
  bodyContent: { paddingBottom: 40 },

  mapHero: {
    height: 300,
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },

  searchWrap: {
    paddingHorizontal: 20,
    marginTop: -32,
    zIndex: 20,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingLeft: 20,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 40,
    elevation: 6,
  },
  searchPillText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  nowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  nowChipText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.text,
    marginRight: 2,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.primary,
    paddingHorizontal: 20,
  },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },

  serviceRow: { gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  serviceCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...CARD_SHADOW,
  },
  serviceCardActive: { borderColor: colors.primary },
  serviceCardDark: { backgroundColor: colors.primary, borderColor: colors.primary },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  serviceLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  serviceSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  textOnDark: { color: '#ffffff' },
  subOnDark: { color: 'rgba(255,255,255,0.7)' },

  savedList: { paddingHorizontal: 20, gap: 8 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  savedAddress: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 1 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.textMuted },

  promo: {
    marginTop: 32,
    marginHorizontal: 20,
    height: 160,
    borderRadius: 24,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  promoTextWrap: { maxWidth: '65%', gap: 12, zIndex: 2 },
  promoTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: '#ffffff',
  },
  promoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  promoBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  promoArt: { position: 'absolute', right: 8, bottom: 4 },
});
