// Dark Google Maps style (night mode) so the map matches the black app theme
// instead of rendering in default light colors. Pass to <MapView customMapStyle={DARK_MAP_STYLE} />.
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e0e0e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a9a9a' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#262626' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a3a3a3' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#16201a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1f1f22' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#161616' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9a9a9a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a2e' }],
  },
  {
    // Highways tinted with the brand orange so the map keeps an accent.
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a2417' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#222226' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#070708' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515154' }],
  },
];
