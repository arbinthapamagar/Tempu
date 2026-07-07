import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bidApi, tripApi } from '../../api/trip.api';
import { userApi } from '../../api/user.api';

// Trip statuses that mean "this driver currently has a live job"
const ACTIVE_TRIP_STATUSES = ['accepted', 'arriving', 'started'];

// What the action button advances to, given the current trip status
export const NEXT_STATUS = {
  accepted: 'arriving',
  arriving: 'started',
  started: 'completed',
};

export const ACTION_LABEL = {
  accepted: "I'm on the way",
  arriving: 'Start trip',
  started: 'Complete trip',
};

/**
 * Drives the entire driver workspace:
 *  - online/offline (with GPS push to the backend)
 *  - polling nearby ride requests while online & idle
 *  - placing bids
 *  - detecting an accepted bid and driving that trip to completion
 */
export default function useDriverFlow(initialOnline = false) {
  const [online, setOnline] = useState(initialOnline);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [coords, setCoords] = useState(null);

  const [nearbyTrips, setNearbyTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [bidTripIds, setBidTripIds] = useState([]); // trips I've already bid on
  const [error, setError] = useState('');

  const [activeTripId, setActiveTripId] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  const coordsRef = useRef(null);
  const watchRef = useRef(null);

  // Location: acquire + watch + push to backend while online
  useEffect(() => {
    if (!online) {
      watchRef.current?.remove?.();
      watchRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to go online.');
        return;
      }
      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;
      const c = { lat: first.coords.latitude, lng: first.coords.longitude };
      coordsRef.current = c;
      setCoords(c);
      userApi.updateDriverLocation(c).catch(() => {});

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 8000 },
        (loc) => {
          const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          coordsRef.current = next;
          setCoords(next);
          userApi.updateDriverLocation(next).catch(() => {});
        }
      );
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove?.();
      watchRef.current = null;
    };
  }, [online]);

  // Poll nearby trips while online and not already driving
  useEffect(() => {
    if (!online || activeTripId) {
      setNearbyTrips([]);
      return;
    }
    let stop = false;
    const poll = async () => {
      const c = coordsRef.current;
      if (!c) return;
      try {
        const res = await userApi.getNearbyTrips({ longitude: c.lng, latitude: c.lat });
        if (!stop) {
          setNearbyTrips(res.data || []);
          setError('');
        }
      } catch (err) {
        if (!stop) setError(err.message || '');
      } finally {
        if (!stop) setLoadingTrips(false);
      }
    };
    setLoadingTrips(true);
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [online, activeTripId, coords]);

  // Detect an accepted bid → promote it to the active trip
  useEffect(() => {
    if (activeTripId) return;
    let stop = false;
    const check = async () => {
      try {
        const res = await bidApi.getMyBids({ status: 'accepted', limit: 5 });
        const bids = res.data?.bids || [];
        const live = bids.find((b) => ACTIVE_TRIP_STATUSES.includes(b.tripId?.status));
        if (!stop && live?.tripId?._id) setActiveTripId(live.tripId._id);
      } catch {
        // ignore - try again next tick
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [activeTripId]);

  // Drive the active trip: poll its status until terminal
  useEffect(() => {
    if (!activeTripId) {
      setActiveTrip(null);
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const res = await tripApi.getById(activeTripId);
        if (stop) return;
        setActiveTrip(res.data);
        if (res.data?.status === 'cancelled') {
          setActiveTripId(null);
        }
      } catch {
        // keep last known state on transient errors
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [activeTripId]);

  const toggleOnline = useCallback(async (val) => {
    setTogglingOnline(true);
    setError('');
    try {
      if (val) await userApi.goOnline();
      else await userApi.goOffline();
      setOnline(val);
    } catch (err) {
      setError(err.message || 'Could not update status.');
      throw err;
    } finally {
      setTogglingOnline(false);
    }
  }, []);

  const placeBid = useCallback(async (tripId, amount, message) => {
    await bidApi.create({ tripId, amount: Number(amount), message });
    setBidTripIds((prev) => (prev.includes(tripId) ? prev : [...prev, tripId]));
  }, []);

  const advanceTrip = useCallback(async () => {
    if (!activeTrip) return;
    const next = NEXT_STATUS[activeTrip.status];
    if (!next) return;
    setAdvancing(true);
    try {
      const res = await tripApi.updateStatus(activeTrip._id, next);
      setActiveTrip(res.data);
    } catch (err) {
      setError(err.message || 'Could not update trip.');
      throw err;
    } finally {
      setAdvancing(false);
    }
  }, [activeTrip]);

  const finishActiveTrip = useCallback(() => {
    setActiveTripId(null);
    setActiveTrip(null);
    setBidTripIds([]);
  }, []);

  return {
    online,
    togglingOnline,
    toggleOnline,
    coords,
    nearbyTrips,
    loadingTrips,
    bidTripIds,
    error,
    placeBid,
    activeTrip,
    advancing,
    advanceTrip,
    finishActiveTrip,
  };
}
