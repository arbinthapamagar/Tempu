// Geographic anchors for the demo map. Replace with real backend data later.
export const KATHMANDU = {
  latitude: 27.7172,
  longitude: 85.324,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export const DEMO_DROP = { latitude: 27.6981, longitude: 85.3592 };
export const DEMO_DRIVER = { latitude: 27.728, longitude: 85.319 };

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'esewa', label: 'eSewa' },
  { id: 'khalti', label: 'Khalti' },
];

// How long the BiddingSheet waits before transitioning to "started" (driver picked up).
export const ARRIVING_TO_STARTED_MS = 4000;

// How long the refresh control spins on the home pull-to-refresh.
export const HOME_REFRESH_MS = 1200;
