import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius, shadow } from '../../theme';
import { DEMO_DRIVER, DEMO_DROP, KATHMANDU } from './constants';

const ZOOMED = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

/**
 * The map embedded in HomeView. Tracks the user's foreground location,
 * shows the driver during bidding/active, and exposes a recenter FAB.
 */
export default function Map({ step }) {
  const mapRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const showDriver = step === 'bidding' || step === 'active';

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const c = {
        latitude: first.coords.latitude,
        longitude: first.coords.longitude,
      };
      setCoords(c);
      mapRef.current?.animateToRegion({ ...c, ...ZOOMED }, 800);
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 4000,
        },
        (loc) =>
          setCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }),
      );
    })();
    return () => sub?.remove?.();
  }, []);

  const recenter = () => {
    if (!coords) return;
    mapRef.current?.animateToRegion({ ...coords, ...ZOOMED }, 500);
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
        {coords && (
          <Marker coordinate={coords} title="You" pinColor={colors.primary} />
        )}
        {step !== 'home' && (
          <Marker coordinate={DEMO_DROP} title="Drop-off" pinColor={colors.text} />
        )}
        {showDriver && (
          <Marker coordinate={DEMO_DRIVER} title="Driver" pinColor="#1a1a1a" />
        )}
      </MapView>

      <Pressable style={styles.recenter} onPress={recenter} hitSlop={6}>
        <Ionicons name="locate" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
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
