import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { userApi } from '../../api/user.api';
import { colors, radius, shadow } from '../../theme';
import { KATHMANDU } from './constants';

const ZOOMED = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
// Leaves room for the bottom sheet + the floating search pill so the route
// isn't hidden behind them.
const EDGE_PADDING = { top: 90, right: 60, bottom: 280, left: 60 };

// App coords are {lat,lng}; react-native-maps wants {latitude,longitude}.
const toLatLng = (c) => (c ? { latitude: c.lat, longitude: c.lng } : null);

/**
 * The ride map. On 'home' it just tracks the user. Once a pickup + destination
 * exist it draws both markers, the driving route (via the backend directions
 * proxy → Google/OSRM) and an ETA · distance pill — the inDrive-style view.
 */
export default function Map({ step, pickupCoords, destCoords, driverCoords }) {
  const mapRef = useRef(null);
  const [coords, setCoords] = useState(null); // live user location
  const [route, setRoute] = useState([]);
  const [routeMeta, setRouteMeta] = useState(null); // { distanceText, durationText }

  const pickup = toLatLng(pickupCoords) || coords;
  const dropoff = toLatLng(destCoords);
  const driver = toLatLng(driverCoords);
  const showDriver = (step === 'bidding' || step === 'active') && !!driver;

  // Track the user's live location; center on them until a destination is set.
  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { latitude: first.coords.latitude, longitude: first.coords.longitude };
      setCoords(c);
      if (!destCoords) mapRef.current?.animateToRegion({ ...c, ...ZOOMED }, 800);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 4000 },
        (loc) => setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
      );
    })();
    return () => sub?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch + draw the route whenever we have both ends.
  useEffect(() => {
    if (!pickupCoords || !destCoords) {
      setRoute([]);
      setRouteMeta(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.geoDirections(pickupCoords, destCoords);
        const line = res?.data?.polyline || [];
        if (cancelled) return;
        setRoute(line);
        setRouteMeta({
          distanceText: res?.data?.distanceText,
          durationText: res?.data?.durationText,
        });
        // Frame the whole route (fall back to the two endpoints if empty).
        const pts = line.length ? line : [toLatLng(pickupCoords), toLatLng(destCoords)];
        setTimeout(() => mapRef.current?.fitToCoordinates(pts, { edgePadding: EDGE_PADDING, animated: true }), 60);
      } catch {
        if (cancelled) return;
        setRoute([]);
        setRouteMeta(null);
        // No route line, but still frame pickup + dropoff.
        const pts = [toLatLng(pickupCoords), toLatLng(destCoords)].filter(Boolean);
        if (pts.length === 2) {
          setTimeout(() => mapRef.current?.fitToCoordinates(pts, { edgePadding: EDGE_PADDING, animated: true }), 60);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pickupCoords, destCoords]);

  const recenter = () => {
    const target = coords || pickup;
    if (target) mapRef.current?.animateToRegion({ ...target, ...ZOOMED }, 500);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={KATHMANDU}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {route.length > 1 && (
          <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} />
        )}

        {pickup && (
          <Marker coordinate={pickup} title="Pickup" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.originDot}>
              <View style={styles.originDotInner} />
            </View>
          </Marker>
        )}

        {dropoff && <Marker coordinate={dropoff} title="Drop-off" pinColor={colors.text} />}

        {showDriver && (
          <Marker coordinate={driver} title="Driver" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.carPin}>
              <Ionicons name="car" size={16} color="#ffffff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* inDrive-style trip pill */}
      {routeMeta?.durationText && (
        <View style={styles.tripPill}>
          <Ionicons name="time-outline" size={15} color={colors.primary} />
          <Text style={styles.tripPillText}>{routeMeta.durationText}</Text>
          {routeMeta.distanceText ? (
            <>
              <View style={styles.tripDot} />
              <Text style={styles.tripPillMuted}>{routeMeta.distanceText}</Text>
            </>
          ) : null}
        </View>
      )}

      <Pressable style={styles.recenter} onPress={recenter} hitSlop={6}>
        <Ionicons name="locate" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  originDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(22,163,74,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  originDotInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2, borderColor: '#ffffff',
  },
  carPin: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff',
    ...shadow.fab,
  },
  tripPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.fab,
  },
  tripPillText: { fontSize: 14, fontWeight: '700', color: colors.text },
  tripPillMuted: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tripDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted },
  recenter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
});
