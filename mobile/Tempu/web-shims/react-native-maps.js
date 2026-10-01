// Web-only stand-in for react-native-maps, wired up in metro.config.js and used
// ONLY when bundling for `platform === 'web'`. The real package imports React
// Native internals (codegenNativeCommands) that don't exist on web, so a web
// bundle can't be built at all without it.
//
// It draws a real, pannable map with Leaflet over OpenStreetMap tiles (no API
// key; CARTO's basemaps now demand one) and implements the slice of the
// react-native-maps API this app uses: region props and change callbacks,
// animateToRegion / fitToCoordinates, showsUserLocation, and Marker (default
// pin or custom children), Polyline, Polygon and Circle overlays. Native builds
// still use Google Maps through the real package.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const FALLBACK_CENTER = { latitude: 27.7172, longitude: 85.324, latitudeDelta: 0.05, longitudeDelta: 0.05 }; // Kathmandu

const MapContext = createContext(null);

const toLatLng = (c) => [c.latitude, c.longitude];

// react-native-maps speaks in region deltas, Leaflet in zoom levels.
function zoomForRegion(r) {
  const delta = Math.max(r.longitudeDelta || 0, r.latitudeDelta || 0) || 0.05;
  return Math.max(2, Math.min(18, Math.round(Math.log2(360 / delta))));
}

function regionOf(map) {
  const c = map.getCenter();
  const b = map.getBounds();
  return {
    latitude: c.lat,
    longitude: c.lng,
    latitudeDelta: b.getNorth() - b.getSouth(),
    longitudeDelta: b.getEast() - b.getWest(),
  };
}

const MapView = forwardRef(function MapView(
  { style, children, initialRegion, region, onRegionChange, onRegionChangeComplete, onPress, showsUserLocation },
  ref
) {
  const elRef = useRef(null);
  const [map, setMap] = useState(null);
  const cb = useRef({});
  cb.current = { onRegionChange, onRegionChangeComplete, onPress };

  useEffect(() => {
    const m = L.map(elRef.current, { zoomControl: false, attributionControl: true });
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    // Set the first view BEFORE subscribing: Leaflet fires movestart while the
    // initial view is still half-built, and getCenter() throws at that point.
    const start = region || initialRegion || FALLBACK_CENTER;
    m.setView(toLatLng(start), zoomForRegion(start), { animate: false });
    m.on('movestart', () => cb.current.onRegionChange?.(regionOf(m)));
    m.on('moveend', () => cb.current.onRegionChangeComplete?.(regionOf(m)));
    m.on('click', (e) =>
      cb.current.onPress?.({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } })
    );
    // Report the starting region once, as the native map does on first layout,
    // so callers that only learn the centre from this callback get a value.
    cb.current.onRegionChangeComplete?.(regionOf(m));

    // Leaflet measures its box once; maps inside sliding modals and sheets start
    // at 0×0, so re-measure whenever the container changes size.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(elRef.current);
    setMap(m);
    return () => {
      ro.disconnect();
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled `region` prop: follow it when the caller changes it.
  useEffect(() => {
    if (map && region) map.setView(toLatLng(region), zoomForRegion(region));
  }, [map, region?.latitude, region?.longitude, region?.latitudeDelta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Blue "you are here" dot, like showsUserLocation on a phone.
  useEffect(() => {
    if (!map || !showsUserLocation || !navigator.geolocation) return undefined;
    let dot = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const ll = [p.coords.latitude, p.coords.longitude];
        if (!dot) {
          dot = L.circleMarker(ll, { radius: 7, color: '#ffffff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
        } else dot.setLatLng(ll);
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      dot?.remove();
    };
  }, [map, showsUserLocation]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r, duration = 500) => {
      if (map && r) map.flyTo(toLatLng(r), zoomForRegion(r), { duration: duration / 1000 });
    },
    animateCamera: (cam) => {
      if (map && cam?.center) map.flyTo(toLatLng(cam.center), cam.zoom ?? map.getZoom());
    },
    setCamera: (cam) => {
      if (map && cam?.center) map.setView(toLatLng(cam.center), cam.zoom ?? map.getZoom());
    },
    fitToCoordinates: (coords = [], { edgePadding: p = {}, animated = true } = {}) => {
      if (!map || !coords.length) return;
      if (coords.length === 1) {
        map.setView(toLatLng(coords[0]), 15, { animate: animated });
        return;
      }
      map.fitBounds(L.latLngBounds(coords.map(toLatLng)), {
        paddingTopLeft: [p.left || 0, p.top || 0],
        paddingBottomRight: [p.right || 0, p.bottom || 0],
        animate: animated,
      });
    },
    fitToElements: () => {},
    fitToSuppliedMarkers: () => {},
    getCamera: async () => {
      const c = map?.getCenter();
      return { center: c ? { latitude: c.lat, longitude: c.lng } : null, zoom: map?.getZoom() };
    },
    getMapBoundaries: async () => {
      if (!map) return null;
      const b = map.getBounds();
      return {
        northEast: { latitude: b.getNorth(), longitude: b.getEast() },
        southWest: { latitude: b.getSouth(), longitude: b.getWest() },
      };
    },
    coordinateForPoint: async ({ x, y }) => {
      const ll = map?.containerPointToLatLng([x, y]);
      return ll ? { latitude: ll.lat, longitude: ll.lng } : null;
    },
    pointForCoordinate: async (c) => {
      const pt = map?.latLngToContainerPoint(toLatLng(c));
      return pt ? { x: pt.x, y: pt.y } : null;
    },
    takeSnapshot: async () => null,
  }), [map]);

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#e8e4dc' }, style]}>
      {/* A plain div: RN-web's View rewrites className on render and would
          strip the classes Leaflet puts on its container. */}
      <div ref={elRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
    </View>
  );
});

// Default teardrop pin, drawn in pinColor like the native one.
function pinHtml(color) {
  return `<svg width="28" height="40" viewBox="0 0 28 40" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">
    <path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 40 14 40s14-15.7 14-26.1C28 6.2 21.7 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="5" fill="#fff"/></svg>`;
}

export function Marker({ coordinate, children, anchor, pinColor = '#e53935', title, onPress, zIndex }) {
  const map = useContext(MapContext);
  const [el] = useState(() => document.createElement('div'));
  const markerRef = useRef(null);
  const custom = children != null && children !== false;
  const ax = anchor?.x ?? 0.5;
  const ay = anchor?.y ?? (custom ? 0.5 : 1);

  useEffect(() => {
    if (!map || !coordinate) return undefined;
    // Shift the content so the anchor point sits on the coordinate.
    el.style.transform = `translate(${-ax * 100}%, ${-ay * 100}%)`;
    el.style.width = 'max-content';
    if (!custom) el.innerHTML = pinHtml(pinColor);
    const icon = L.divIcon({ html: el, className: '', iconSize: null });
    const mk = L.marker(toLatLng(coordinate), { icon, title, zIndexOffset: zIndex || 0, keyboard: false }).addTo(map);
    markerRef.current = mk;
    return () => {
      mk.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, custom, pinColor, ax, ay, !!coordinate]);

  useEffect(() => {
    if (markerRef.current && coordinate) markerRef.current.setLatLng(toLatLng(coordinate));
  }, [coordinate?.latitude, coordinate?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mk = markerRef.current;
    if (!mk || !onPress) return undefined;
    const h = () => onPress({ nativeEvent: { coordinate } });
    mk.on('click', h);
    return () => mk.off('click', h);
  });

  return custom ? createPortal(children, el) : null;
}

// Shared lifecycle for the vector overlays: create once, then keep in sync.
function useLayer(make, update, deps) {
  const map = useContext(MapContext);
  const layer = useRef(null);
  useEffect(() => {
    if (!map) return undefined;
    layer.current = make().addTo(map);
    return () => {
      layer.current?.remove();
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  useEffect(() => {
    if (layer.current) update(layer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Polyline({ coordinates = [], strokeColor = '#000', strokeWidth = 2 }) {
  useLayer(
    () => L.polyline(coordinates.map(toLatLng), { color: strokeColor, weight: strokeWidth }),
    (l) => {
      l.setLatLngs(coordinates.map(toLatLng));
      l.setStyle({ color: strokeColor, weight: strokeWidth });
    },
    [coordinates, strokeColor, strokeWidth]
  );
  return null;
}

export function Polygon({ coordinates = [], strokeColor = '#000', strokeWidth = 1, fillColor = 'rgba(0,0,0,0.2)' }) {
  useLayer(
    () => L.polygon(coordinates.map(toLatLng), { color: strokeColor, weight: strokeWidth, fillColor, fillOpacity: 1 }),
    (l) => {
      l.setLatLngs(coordinates.map(toLatLng));
      l.setStyle({ color: strokeColor, weight: strokeWidth, fillColor });
    },
    [coordinates, strokeColor, strokeWidth, fillColor]
  );
  return null;
}

export function Circle({ center, radius = 0, strokeColor = '#000', strokeWidth = 1, fillColor = 'rgba(0,0,0,0.2)' }) {
  useLayer(
    () => L.circle(toLatLng(center), { radius, color: strokeColor, weight: strokeWidth, fillColor, fillOpacity: 1 }),
    (l) => {
      l.setLatLng(toLatLng(center));
      l.setRadius(radius);
      l.setStyle({ color: strokeColor, weight: strokeWidth, fillColor });
    },
    [center?.latitude, center?.longitude, radius, strokeColor, strokeWidth, fillColor]
  );
  return null;
}

// Not used by the app on web.
const nothing = () => null;
export const Callout = nothing;
export const Overlay = nothing;

export default MapView;
