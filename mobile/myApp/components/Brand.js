import { useState } from 'react';
import { Image, View } from 'react-native';
import { PaymentChip, VehicleTile } from './Icons';
import { colors } from '../theme/colors';

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
  esewa: require('../assets/payments/esewa.gif'),
  khalti: require('../assets/payments/khalti.png'),
  phonepe: null, // require('../assets/payments/phonepe.png')
  cash: null, // require('../assets/payments/cash.png')
};

const VEHICLE_IMAGES = {
  taxi: null, // require('../assets/vehicles/taxi.png')
  comfort: null, // require('../assets/vehicles/comfort.png')
  bike: null, // require('../assets/vehicles/bike.png')
  scooter: require('../assets/vehicles/scooter.jpg'),
  tuktuk: require('../assets/vehicles/tuktuk.png'),
  tuktuk_delivery: null, // require('../assets/vehicles/delivery.png')
};

function ImageWithFallback({ source, size, fallback, radius, plain }) {
  const [failed, setFailed] = useState(false);
  if (!source || failed) return fallback;
  if (plain) {
    return (
      <Image
        source={source}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius != null ? radius : size * 0.28,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Image
        source={source}
        onError={() => setFailed(true)}
        style={{ width: size * 0.78, height: size * 0.78 }}
        resizeMode="contain"
      />
    </View>
  );
}

export function PaymentLogo({ id, size = 44 }) {
  return (
    <ImageWithFallback
      source={PAYMENT_IMAGES[id]}
      size={size}
      fallback={<PaymentChip id={id} size={size} />}
    />
  );
}

export function VehiclePhoto({ type, size = 64 }) {
  return (
    <ImageWithFallback
      source={VEHICLE_IMAGES[type]}
      size={size}
      plain
      fallback={<VehicleTile type={type} size={size} />}
    />
  );
}
