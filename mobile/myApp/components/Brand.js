import { useState } from 'react';
import { Image, View } from 'react-native';
import {
  CardIcon,
  CashIcon,
  PaymentBadge,
  VehicleIcon,
  WalletIcon,
} from './Icons';

// Drop your own brand logos / vehicle photos into these paths and they'll
// show automatically. Until then, the colored vector icon is used as fallback.
//
// Expected files (any of png / jpg / webp works):
//   assets/payments/esewa.png
//   assets/payments/khalti.png
//   assets/payments/wallet.png
//   assets/payments/cash.png
//   assets/vehicles/taxi.png
//   assets/vehicles/comfort.png
//   assets/vehicles/bike.png
//   assets/vehicles/scooter.png
//   assets/vehicles/tuktuk.png
//   assets/vehicles/delivery.png
//
// To enable: replace `null` below with `require('../assets/...')` once the
// file exists.

const PAYMENT_IMAGES = {
  esewa: null, // require('../assets/payments/esewa.png')
  khalti: null, // require('../assets/payments/khalti.png')
  wallet: null, // require('../assets/payments/wallet.png')
  cash: null, // require('../assets/payments/cash.png')
};

const VEHICLE_IMAGES = {
  taxi: null, // require('../assets/vehicles/taxi.png')
  comfort: null, // require('../assets/vehicles/comfort.png')
  bike: null, // require('../assets/vehicles/bike.png')
  scooter: null, // require('../assets/vehicles/scooter.png')
  tuktuk: null, // require('../assets/vehicles/tuktuk.png')
  tuktuk_delivery: null, // require('../assets/vehicles/delivery.png')
};

function ImageWithFallback({ source, size, fallback, rounded }) {
  const [failed, setFailed] = useState(false);
  if (!source || failed) return fallback;
  return (
    <Image
      source={source}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? size / 2 : 6,
      }}
      resizeMode="contain"
    />
  );
}

export function PaymentLogo({ id, size = 24 }) {
  return (
    <ImageWithFallback
      source={PAYMENT_IMAGES[id]}
      size={size}
      fallback={<PaymentBadge id={id} size={size} />}
    />
  );
}

export function VehiclePhoto({ type, size = 56, rounded = false }) {
  return (
    <ImageWithFallback
      source={VEHICLE_IMAGES[type]}
      size={size}
      rounded={rounded}
      fallback={
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VehicleIcon type={type} size={size * 0.75} />
        </View>
      }
    />
  );
}
