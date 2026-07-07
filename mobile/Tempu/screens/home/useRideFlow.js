import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bidApi, tripApi } from '../../api/trip.api';
import { userApi } from '../../api/user.api';

const VEHICLE_TYPES = [
  { id: 'tuktuk', name: 'Rickshaw', note: 'Up to 3 passengers', baseFare: 80, eta: 3 },
  { id: 'scooter', name: 'Scooter', note: 'Quick & affordable', baseFare: 60, eta: 4 },
  { id: 'taxi', name: 'Taxi', note: 'Comfortable car', baseFare: 150, eta: 5 },
  { id: 'tuktuk_delivery', name: 'Delivery', note: 'Package delivery', baseFare: 100, eta: 4 },
];

export { VEHICLE_TYPES };

async function resolveCurrentPosition() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const me = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const res = await Location.reverseGeocodeAsync({
    latitude: me.coords.latitude,
    longitude: me.coords.longitude,
  });
  const first = res?.[0];
  const address = first
    ? [first.name, first.street, first.district, first.city]
        .filter(Boolean)
        .slice(0, 2)
        .join(', ')
    : null;
  return {
    address,
    coords: { lat: me.coords.latitude, lng: me.coords.longitude },
  };
}

export default function useRideFlow() {
  const [step, setStep] = useState('home');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [vehicleId, setVehicleId] = useState('tuktuk');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [payment, setPayment] = useState('cash');
  const [acceptedBid, setAcceptedBid] = useState(null);
  const [tripStatus, setTripStatus] = useState('arriving');
  const [locating, setLocating] = useState(true);
  const [standardFare, setStandardFare] = useState(null); // bid floor from Pricing Control

  // Trip + bidding state
  const [tripId, setTripId] = useState(null);
  const [bids, setBids] = useState([]);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [tripError, setTripError] = useState('');
  const [biddingTimedOut, setBiddingTimedOut] = useState(false);
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const tripStatusPollRef = useRef(null);

  // Pre-fill pickup from GPS on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await resolveCurrentPosition();
        if (!cancelled && pos) {
          setPickup(pos.address || '');
          setPickupCoords(pos.coords);
        }
      } catch {
        // permission denied or offline — leave empty
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch the standard fare (bid floor) once we're choosing a ride and have a route
  useEffect(() => {
    if (step !== 'options' || !vehicleId || !pickupCoords || !destCoords) {
      setStandardFare(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.getFareQuote({
          vehicleType: vehicleId,
          lat1: pickupCoords.lat, lng1: pickupCoords.lng,
          lat2: destCoords.lat, lng2: destCoords.lng,
        });
        if (!cancelled) setStandardFare(res.data?.standardFare ?? null);
      } catch {
        if (!cancelled) setStandardFare(null); // server still enforces on create
      }
    })();
    return () => { cancelled = true; };
  }, [step, vehicleId, pickupCoords, destCoords]);

  // Poll bids while in bidding step
  useEffect(() => {
    if (step !== 'bidding' || !tripId) return;

    setBiddingTimedOut(false);

    const poll = async () => {
      try {
        const res = await bidApi.getForTrip(tripId);
        setBids(res.data || []);
      } catch {
        // network glitch — keep showing existing bids
      }
    };

    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, 3000);

    // Auto-cancel after 5 minutes
    timeoutRef.current = setTimeout(() => {
      clearInterval(pollRef.current);
      setBiddingTimedOut(true);
      if (tripId) tripApi.cancel(tripId).catch(() => {});
      setTripId(null);
      setBids([]);
      setStep('options');
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollRef.current);
      clearTimeout(timeoutRef.current);
      pollRef.current = null;
      timeoutRef.current = null;
    };
  }, [step, tripId]);

  useEffect(() => {
    if (step === 'bidding') {
      setAcceptedBid(null);
      setBids([]);
    }
  }, [step]);

  // Poll trip status every 5s while on active trip
  useEffect(() => {
    if (step !== 'active' || !tripId) return;

    const poll = async () => {
      try {
        const res = await tripApi.getById(tripId);
        const status = res.data?.status;
        if (status) setTripStatus(status);
        if (status === 'cancelled') {
          clearInterval(tripStatusPollRef.current);
          reset();
        } else if (status === 'completed') {
          clearInterval(tripStatusPollRef.current);
          // Stay on 'active' step so user sees completed state and can rate
        }
      } catch {}
    };

    poll();
    tripStatusPollRef.current = setInterval(poll, 5000);
    return () => clearInterval(tripStatusPollRef.current);
  }, [step, tripId]);

  const reset = useCallback(() => {
    setStep('home');
    setDestination('');
    setDestCoords(null);
    setVehicleId('tuktuk');
    setOfferedPrice('');
    setAcceptedBid(null);
    setTripStatus('arriving');
    setTripId(null);
    setBids([]);
    setTripError('');
    setBiddingTimedOut(false);
    clearInterval(pollRef.current);
    clearTimeout(timeoutRef.current);
    clearInterval(tripStatusPollRef.current);
  }, []);

  const goBack = useCallback(() => {
    if (step === 'search') setStep('home');
    else if (step === 'map-pick') setStep('search');
    else if (step === 'options') setStep('search');
    else if (step === 'bidding') {
      // Cancel trip if exists
      if (tripId) tripApi.cancel(tripId).catch(() => {});
      setTripId(null);
      setBids([]);
      setStep('options');
    } else if (step === 'active') reset();
  }, [step, tripId, reset]);

  const requestRide = useCallback(async () => {
    if (!destination.trim()) return;
    const price = Number(offeredPrice);
    if (!price || price < 50) return;

    setTripError('');
    setCreatingTrip(true);

    try {
      let pCoords = pickupCoords;
      let dCoords = destCoords;

      if (!pCoords && pickup) {
        const r = await Location.geocodeAsync(pickup);
        if (r?.[0]) pCoords = { lat: r[0].latitude, lng: r[0].longitude };
      }
      if (!dCoords && destination) {
        const r = await Location.geocodeAsync(destination);
        if (r?.[0]) dCoords = { lat: r[0].latitude, lng: r[0].longitude };
      }

      if (!pCoords || !dCoords) {
        setTripError('Could not determine location. Use the map pin to set pickup and destination.');
        setCreatingTrip(false);
        return;
      }

      const res = await tripApi.create({
        pickup: {
          address: pickup,
          location: { type: 'Point', coordinates: [pCoords.lng, pCoords.lat] },
        },
        dropoff: {
          address: destination,
          location: { type: 'Point', coordinates: [dCoords.lng, dCoords.lat] },
        },
        vehicleType: vehicleId,
        offeredPrice: price,
        paymentMethod: payment,
      });

      setTripId(res.data._id);
      setStep('bidding');
    } catch (err) {
      setTripError(err.message || 'Failed to create trip. Please try again.');
    } finally {
      setCreatingTrip(false);
    }
  }, [destination, offeredPrice, pickup, pickupCoords, destCoords, vehicleId, payment]);

  const acceptBid = useCallback(async (bid) => {
    try {
      await bidApi.accept(bid._id);
      setAcceptedBid(bid);
      setStep('active');
      setTripStatus('arriving');
    } catch (err) {
      setTripError(err.message || 'Failed to accept bid.');
    }
  }, []);

  return {
    step,
    setStep,
    pickup,
    setPickup,
    pickupCoords,
    setPickupCoords,
    destination,
    setDestination,
    destCoords,
    setDestCoords,
    vehicleId,
    setVehicleId,
    offeredPrice,
    setOfferedPrice,
    payment,
    setPayment,
    acceptedBid,
    tripStatus,
    setTripStatus,
    locating,
    standardFare,
    tripId,
    bids,
    creatingTrip,
    tripError,
    biddingTimedOut,
    goBack,
    reset,
    requestRide,
    acceptBid,
  };
}
