import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export const VEHICLE_META = {
  taxi: { name: 'taxi', color: '#f5b400', lib: 'mci' },
  comfort: { name: 'car-sport', color: '#1e3a5f', lib: 'mci' },
  bike: { name: 'motorbike', color: '#e0464a', lib: 'mci' },
  scooter: { name: 'scooter', color: '#3aa6a0', lib: 'mci' },
  tuktuk: { name: 'rickshaw', color: '#e89711', lib: 'mci' },
  tuktuk_delivery: { name: 'package-variant-closed', color: '#c2864a', lib: 'mci' },
};

export function VehicleIcon({ type, size = 36, color }) {
  if (type === 'tuktuk_delivery') {
    return <DeliveryArt size={size} />;
  }
  const meta = VEHICLE_META[type] || VEHICLE_META.taxi;
  return (
    <MaterialCommunityIcons
      name={meta.name}
      size={size}
      color={color || meta.color}
    />
  );
}

// Stacked delivery illustration: scooter with package on top
export function DeliveryArt({ size = 64 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', top: 0, right: size * 0.18 }}>
        <MaterialCommunityIcons
          name="package-variant-closed"
          size={size * 0.42}
          color="#c2864a"
        />
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <MaterialCommunityIcons
          name="moped"
          size={size * 0.72}
          color="#3aa6a0"
        />
      </View>
    </View>
  );
}

export function PinIcon({ size = 16, color = '#1f7a4d' }) {
  return <Ionicons name="location" size={size} color={color} />;
}

export function FlagIcon({ size = 16, color = '#0a0e0c' }) {
  return <Ionicons name="flag" size={size} color={color} />;
}

export function SearchIcon({ size = 20, color = '#0a0e0c' }) {
  return <Ionicons name="search" size={size} color={color} />;
}

export function ChevronIcon({ size = 16, color = '#6b7570', dir = 'right' }) {
  const map = {
    right: 'chevron-forward',
    left: 'chevron-back',
    down: 'chevron-down',
    up: 'chevron-up',
  };
  return <Ionicons name={map[dir]} size={size} color={color} />;
}

export function StarIcon({ size = 14, color = '#f5b400', filled = true }) {
  return (
    <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={color} />
  );
}

export function WalletIcon({ size = 22, color = '#c98a2a' }) {
  return <Ionicons name="wallet" size={size} color={color} />;
}

export function BellIcon({ size = 22, color = '#e0464a' }) {
  return <Ionicons name="notifications" size={size} color={color} />;
}

export function HomeIcon({ size = 22, color = '#1f7a4d' }) {
  return <Ionicons name="home" size={size} color={color} />;
}

export function DocIcon({ size = 22, color = '#5c6fff' }) {
  return <Ionicons name="document-text" size={size} color={color} />;
}

export function UserIcon({ size = 22, color = '#7a4d20' }) {
  return <Ionicons name="person" size={size} color={color} />;
}

export function CallIcon({ size = 16, color = '#1f7a4d' }) {
  return <Ionicons name="call" size={size} color={color} />;
}

export function ChatIcon({ size = 16, color = '#5c6fff' }) {
  return <Ionicons name="chatbubble-ellipses" size={size} color={color} />;
}

export function ShareIcon({ size = 16, color = '#0a0e0c' }) {
  return <Ionicons name="share-social" size={size} color={color} />;
}

export function ShieldIcon({ size = 16, color = '#1f7a4d' }) {
  return <Ionicons name="shield-checkmark" size={size} color={color} />;
}

export function ReceiptIcon({ size = 16, color = '#5c6fff' }) {
  return <Ionicons name="receipt" size={size} color={color} />;
}

export function CardIcon({ size = 18, color = '#0a0e0c' }) {
  return <Ionicons name="card" size={size} color={color} />;
}

export function CashIcon({ size = 18, color = '#1f7a4d' }) {
  return <MaterialCommunityIcons name="cash-multiple" size={size} color={color} />;
}

export function ArrowDownIcon({ size = 14, color = '#1f7a4d' }) {
  return <Ionicons name="arrow-down" size={size} color={color} />;
}

export function ArrowUpIcon({ size = 14, color = '#0a0e0c' }) {
  return <Ionicons name="arrow-up" size={size} color={color} />;
}

export function PlusIcon({ size = 16, color = '#0a0e0c' }) {
  return <Ionicons name="add" size={size} color={color} />;
}

export function CheckIcon({ size = 14, color = '#1f7a4d' }) {
  return <Ionicons name="checkmark" size={size} color={color} />;
}

export function CloseIcon({ size = 14, color = '#c43d3d' }) {
  return <Ionicons name="close" size={size} color={color} />;
}

export function HomeOutlineIcon({ size = 22, color }) {
  return <Ionicons name="home-outline" size={size} color={color} />;
}

export function BackpackIcon({ size = 28, color = '#5c6fff' }) {
  return <MaterialCommunityIcons name="bag-personal" size={size} color={color} />;
}

export function PackageIcon({ size = 28, color = '#7a4d20' }) {
  return (
    <MaterialCommunityIcons name="package-variant" size={size} color={color} />
  );
}

export const PAYMENT_BRAND = {
  cash: { bg: '#1f7a4d', accent: '#e8f3ec', label: 'Cash', short: 'C' },
  esewa: { bg: '#2c8f4a', accent: '#e0f4e6', label: 'eSewa', short: 'eS' },
  khalti: { bg: '#5c2d91', accent: '#ede4f7', label: 'Khalti', short: 'Kh' },
};

export function PaymentBadge({ id, size = 22 }) {
  if (id === 'cash') return <CashIcon size={size} color="#1f7a4d" />;
  return <CardIcon size={size} color={id === 'khalti' ? '#5c2d91' : '#2c8f4a'} />;
}

// Premium chip: brand-colored rounded square with logotype-style text
export function PaymentChip({ id, size = 44 }) {
  const b = PAYMENT_BRAND[id] || PAYMENT_BRAND.cash;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: b.bg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: b.bg,
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: size * 0.34,
          fontWeight: '900',
          letterSpacing: -0.5,
        }}
      >
        {b.short}
      </Text>
    </View>
  );
}

// Tile-style vehicle: large colored rounded square with the vehicle icon on top
export const VEHICLE_TILE_BG = {
  taxi: '#fff4d6',
  comfort: '#dbe6f4',
  bike: '#fde0e1',
  scooter: '#d6efee',
  tuktuk: '#fde9c8',
  tuktuk_delivery: '#ecdcc8',
};

export function VehicleTile({ type, size = 64 }) {
  const bg = VEHICLE_TILE_BG[type] || '#f3f5f2';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <VehicleIcon type={type} size={size * 0.7} />
    </View>
  );
}

// Generic round icon wrapper for use behind small icons
export function IconBubble({ children, size = 36, bg = '#f3f5f2' }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
