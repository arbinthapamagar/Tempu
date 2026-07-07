import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BellIcon,
  CardIcon,
  ChatIcon,
  DocIcon,
  HomeIcon,
  UserIcon,
  WalletIcon,
} from './Icons';
import { colors } from '../theme/colors';

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'trips', label: 'Trips', Icon: DocIcon },
  { id: 'wallet', label: 'Wallet', Icon: WalletIcon },
  { id: 'subscribe', label: 'Subscribe', Icon: CardIcon },
  { id: 'inbox', label: 'Inbox', Icon: BellIcon },
  { id: 'support', label: 'Support', Icon: ChatIcon },
  { id: 'account', label: 'Account', Icon: UserIcon },
];

export default function TabBar({ active, onChange, isDriver = false }) {
  // The Wallet tab is driver-only; normal passengers don't see it.
  const tabs = TABS.filter((t) => t.id !== 'wallet' || isDriver);
  return (
    <View style={styles.wrap}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        const Icon = t.Icon;
        const color = isActive ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={t.id}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={() => onChange(t.id)}
            hitSlop={6}
          >
            <View style={styles.iconBox}>
              <Icon size={24} color={color} />
            </View>
            <Text
              style={[
                styles.label,
                isActive && [styles.labelActive, { color: colors.primary }],
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 18,
  },
  // Active tab sits in a soft orange-tinted pill, echoing the mockup nav.
  itemActive: {
    backgroundColor: colors.primarySoft,
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});
