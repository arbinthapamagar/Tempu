import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius, shadow, spacing, STATUS_TOP_PAD, type } from '../theme';
import {
  pick as hapticPick,
  success as hapticSuccess,
  tap as hapticTap,
} from './haptics';
import Button from './ui/Button';

const DEFAULT_REGION = {
  latitude: 27.7172,
  longitude: 85.324,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};
const ZOOMED = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

/**
 * Full-screen address picker. Shows a Google map with a centred pin; the
 * pin's coordinates are reverse-geocoded and passed back via `onConfirm`.
 *
 * Used by both the home search "Set on map" action and the saved-address
 * editor inside the Account screen.
 */
export default function MapPicker({ visible, title = 'Drop-off', onCancel, onConfirm }) {
  const mapRef = useRef(null);
  const [center, setCenter] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const [address, setAddress] = useState('Loading address…');
  const [resolving, setResolving] = useState(false);
  // Pin animation: lifts to -22 while the user is dragging / resolving,
  // drops back to 0 with a tiny bounce when the address settles.
  const pinLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const me = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const c = { latitude: me.coords.latitude, longitude: me.coords.longitude };
      setCenter(c);
      mapRef.current?.animateToRegion({ ...c, ...ZOOMED }, 600);
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const res = await Location.reverseGeocodeAsync(center);
        if (cancelled) return;
        const first = res?.[0];
        if (first) {
          const parts = [first.name, first.street, first.district, first.city].filter(
            Boolean,
          );
          setAddress(parts.slice(0, 2).join(', ') || 'Selected location');
        } else {
          setAddress('Selected location');
        }
      } catch {
        if (!cancelled) setAddress('Selected location');
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center.latitude, center.longitude, visible]);

  // Drive the pin animation off `resolving`. Drop-down also fires a haptic
  // tick so the user feels the pin land.
  useEffect(() => {
    if (resolving) {
      Animated.timing(pinLift, {
        toValue: -22,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      hapticTap();
      Animated.spring(pinLift, {
        toValue: 0,
        damping: 9,
        stiffness: 200,
        mass: 0.6,
        useNativeDriver: true,
      }).start();
    }
  }, [resolving, pinLift]);

  const shadowScale = pinLift.interpolate({
    inputRange: [-22, 0],
    outputRange: [0.6, 1],
  });
  const shadowOpacity = pinLift.interpolate({
    inputRange: [-22, 0],
    outputRange: [0.15, 0.35],
  });

  const recenter = async () => {
    try {
      hapticPick();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const me = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const c = { latitude: me.coords.latitude, longitude: me.coords.longitude };
      setCenter(c);
      mapRef.current?.animateToRegion({ ...c, ...ZOOMED }, 500);
    } catch {
      // Permission denied or hardware unavailable — silently no-op.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onRegionChange={() => {
            // Lift the pin the moment the user starts dragging.
            if (!resolving) setResolving(true);
          }}
          onRegionChangeComplete={(r) => {
            hapticPick();
            setCenter({ latitude: r.latitude, longitude: r.longitude });
          }}
        />

        <View pointerEvents="none" style={styles.pinAnchor}>
          <Animated.View
            style={[
              styles.pinShadow,
              {
                opacity: shadowOpacity,
                transform: [{ scale: shadowScale }],
              },
            ]}
          />
          <Animated.View
            style={[styles.pinWrap, { transform: [{ translateY: pinLift }] }]}
          >
            <View style={styles.pinHead} />
            <View style={styles.pinNeedle} />
            <View style={styles.pinDot} />
          </Animated.View>
        </View>

        <Pressable style={styles.close} onPress={onCancel} hitSlop={6}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>

        <Pressable style={styles.recenter} onPress={recenter} hitSlop={6}>
          <Ionicons name="locate" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.sheet}>
          <Text style={styles.kicker}>{title}</Text>
          <Text style={styles.address} numberOfLines={2}>
            {resolving ? 'Finding address…' : address}
          </Text>

          <Pressable style={styles.myLocBtn} onPress={recenter}>
            <Ionicons name="locate" size={16} color={colors.primary} />
            <Text style={styles.myLocText}>Use my current location</Text>
          </Pressable>

          <Button
            label="Confirm location"
            onPress={() => {
              hapticSuccess();
              onConfirm({ address, coords: center });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pinAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    height: 56,
    marginLeft: -16,
    marginTop: -56,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinWrap: {
    alignItems: 'center',
  },
  pinHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  pinNeedle: {
    width: 2,
    height: 22,
    backgroundColor: colors.primary,
    marginTop: -2,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: -1,
  },
  pinShadow: {
    position: 'absolute',
    bottom: -4,
    width: 16,
    height: 4,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  close: {
    position: 'absolute',
    top: STATUS_TOP_PAD + 8,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
  recenter: {
    position: 'absolute',
    bottom: 220,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 4,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    ...shadow.sheet,
  },
  kicker: { ...type.eyebrow, color: colors.textMuted, marginBottom: 6 },
  address: { ...type.h2, color: colors.text, marginBottom: spacing.md + 2 },
  myLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md - 2,
  },
  myLocText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
