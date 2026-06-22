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

const ACTIVE = '#1f242b';
const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon, color: ACTIVE },
  { id: 'trips', label: 'Trips', Icon: DocIcon, color: ACTIVE },
  { id: 'wallet', label: 'Wallet', Icon: WalletIcon, color: ACTIVE },
  { id: 'subscribe', label: 'Subscribe', Icon: CardIcon, color: ACTIVE },
  { id: 'inbox', label: 'Inbox', Icon: BellIcon, color: ACTIVE },
  { id: 'support', label: 'Support', Icon: ChatIcon, color: ACTIVE },
  { id: 'account', label: 'Account', Icon: UserIcon, color: ACTIVE },
];

export default function TabBar({ active, onChange }) {
  return (
    <View style={styles.wrap}>
      {TABS.map((t) => {
        const isActive = t.id === active;
        const Icon = t.Icon;
        const color = isActive ? t.color : '#9aa39e';
        return (
          <Pressable
            key={t.id}
            style={styles.item}
            onPress={() => onChange(t.id)}
            hitSlop={6}
          >
            <View style={styles.iconBox}>
              <Icon size={24} color={color} />
            </View>
            <Text
              style={[
                styles.label,
                isActive && [styles.labelActive, { color: t.color }],
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
    paddingTop: 10,
    paddingBottom: 18,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
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
