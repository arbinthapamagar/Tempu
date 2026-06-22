import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlagIcon, PinIcon } from '../../components/Icons';
import { confirm as hapticConfirm, pick as hapticPick } from '../../components/haptics';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, type } from '../../theme';

const SAVED_ICON = { home: 'home', work: 'briefcase' };

// Kathmandu valley bounding box
const KTM_VIEWBOX = '85.2200,27.6200,85.5000,27.8000';

async function searchPlaces(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&addressdetails=1&limit=8` +
    `&countrycodes=np` +
    `&viewbox=${KTM_VIEWBOX}&bounded=0` +
    `&accept-language=en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TempuApp/1.0 (ride-sharing Nepal)' },
  });
  const data = await res.json();
  return data.sort((a, b) => {
    const inKtm = (r) => {
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      return lat > 27.62 && lat < 27.80 && lon > 85.22 && lon < 85.50;
    };
    return (inKtm(b) ? 1 : 0) - (inKtm(a) ? 1 : 0);
  });
}

function placeTitle(r) {
  return r.name || r.display_name.split(',')[0];
}
function placeSubtitle(r) {
  return r.display_name.split(',').map(s => s.trim()).slice(1, 3).join(', ');
}

export default function SearchSheet({
  pickup, setPickup, setPickupCoords,
  destination, setDestination,
  onPick, onBack, onSubmit,
  onPickPickupOnMap, onPickDestOnMap,
}) {
  const { user } = useAuth();
  const savedAddresses = user?.savedAddresses || [];
  const [activeField, setActiveField] = useState('dest');
  const [places, setPlaces] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const pickupRef = useRef(null);
  const destRef = useRef(null);

  const query = activeField === 'pickup' ? pickup : destination;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setPlaces([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try { setPlaces((await searchPlaces(query)) || []); }
      catch { setPlaces([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const filteredSaved = useMemo(
    () => savedAddresses.filter(s =>
      !query ||
      s.address.toLowerCase().includes(query.toLowerCase()) ||
      s.label.toLowerCase().includes(query.toLowerCase())
    ),
    [query, savedAddresses],
  );

  const pickPlace = (result) => {
    hapticPick();
    const address = placeTitle(result) + ', ' + placeSubtitle(result);
    const coords = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    if (activeField === 'pickup') {
      setPickup(address); setPickupCoords?.(coords);
      setPlaces([]); setActiveField('dest');
      setTimeout(() => destRef.current?.focus(), 50);
    } else {
      onPick(address, coords);
    }
  };

  const pickSaved = (address) => {
    hapticPick();
    if (activeField === 'pickup') {
      setPickup(address); setPlaces([]); setActiveField('dest');
      setTimeout(() => destRef.current?.focus(), 50);
    } else {
      onPick(address);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Top bar with back button */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Search destination</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Input fields */}
        <View style={styles.inputBlock}>
          <View style={styles.routeIcons}>
            <View style={styles.dotGreen} />
            <View style={styles.vline} />
            <View style={styles.dotGrey} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {/* Pickup */}
            <View style={[styles.inputRow, activeField === 'pickup' && styles.inputRowActive]}>
              <TextInput
                ref={pickupRef}
                value={pickup}
                onChangeText={setPickup}
                onFocus={() => setActiveField('pickup')}
                placeholder="Pickup location"
                placeholderTextColor={colors.textFaint}
                style={styles.textInput}
              />
              {pickup ? (
                <Pressable onPress={() => setPickup('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.inputDivider} />

            {/* Destination */}
            <View style={[styles.inputRow, activeField === 'dest' && styles.inputRowActive]}>
              <TextInput
                ref={destRef}
                value={destination}
                onChangeText={setDestination}
                onFocus={() => setActiveField('dest')}
                placeholder="Where are you going?"
                placeholderTextColor={colors.textFaint}
                autoFocus
                style={styles.textInput}
                returnKeyType="search"
                onSubmitEditing={onSubmit}
              />
              {destination ? (
                <Pressable onPress={() => setDestination('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textFaint} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Map pick buttons */}
        <View style={styles.mapBtns}>
          <Pressable style={styles.mapBtn} onPress={() => { hapticConfirm(); onPickPickupOnMap?.(); }}>
            <Ionicons name="locate" size={15} color={colors.primary} />
            <Text style={styles.mapBtnText}>Set pickup on map</Text>
          </Pressable>
          <View style={styles.mapBtnDivider} />
          <Pressable style={styles.mapBtn} onPress={() => { hapticConfirm(); onPickDestOnMap?.(); }}>
            <Ionicons name="map-outline" size={15} color={colors.primary} />
            <Text style={styles.mapBtnText}>Set drop-off on map</Text>
          </Pressable>
        </View>

        {/* Results list — fills space between inputs and keyboard */}
        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {searching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Searching places in Kathmandu…</Text>
            </View>
          )}

          {filteredSaved.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Saved places</Text>
              {filteredSaved.map((s) => (
                <Pressable key={s.label} style={styles.row} onPress={() => pickSaved(s.address)}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name={SAVED_ICON[s.label] || 'location'} size={16} color={colors.primaryDark} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{s.label.charAt(0).toUpperCase() + s.label.slice(1)}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{s.address}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {places.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                {query ? `Results for "${query}"` : 'Nearby places'}
              </Text>
              {places.map((r) => (
                <Pressable key={r.place_id} style={styles.row} onPress={() => pickPlace(r)}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{placeTitle(r)}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{placeSubtitle(r)}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {!searching && query?.length >= 2 && places.length === 0 && filteredSaved.length === 0 && (
            <Text style={styles.empty}>No places found for "{query}"</Text>
          )}

          {!query && filteredSaved.length === 0 && (
            <View style={styles.hint}>
              <Ionicons name="search" size={32} color={colors.border} />
              <Text style={styles.hintText}>
                Type to search for {activeField === 'pickup' ? 'pickup location' : 'destination'}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    zIndex: 100,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 56,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  kav: { flex: 1 },

  inputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  routeIcons: {
    alignItems: 'center',
    width: 12,
    paddingVertical: 4,
    gap: 0,
  },
  dotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2, borderColor: colors.primarySoft,
  },
  vline: { width: 2, height: 20, backgroundColor: colors.border, marginVertical: 3 },
  dotGrey: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.textMuted,
    borderWidth: 2, borderColor: colors.border,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputRowActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  inputDivider: { height: 4 },

  mapBtns: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  mapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  mapBtnDivider: { width: 1, backgroundColor: colors.divider },
  mapBtnText: { fontSize: 13, color: colors.text, fontWeight: '600' },

  results: { flex: 1, paddingHorizontal: 16 },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  loadingText: { color: colors.textMuted, fontSize: 13 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 16, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  empty: {
    color: colors.textMuted, fontSize: 13,
    textAlign: 'center', paddingVertical: 32,
  },
  hint: {
    alignItems: 'center', gap: 10,
    paddingTop: 48, paddingHorizontal: 32,
  },
  hintText: {
    color: colors.textMuted, fontSize: 14,
    textAlign: 'center', lineHeight: 20,
  },
});
