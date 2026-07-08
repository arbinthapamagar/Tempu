import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BellIcon,
  CardIcon,
  ChatIcon,
  CloseIcon,
  DocIcon,
  HomeIcon,
  UserIcon,
  WalletIcon,
} from './Icons';
import { colors } from '../theme/colors';
import { STATUS_TOP_PAD } from '../theme';

const NAV = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'trips', label: 'Trips', Icon: DocIcon },
  { id: 'wallet', label: 'Wallet', Icon: WalletIcon },
  { id: 'subscribe', label: 'Subscribe', Icon: CardIcon },
  { id: 'inbox', label: 'Inbox', Icon: BellIcon },
  { id: 'support', label: 'Support', Icon: ChatIcon },
  { id: 'account', label: 'Account', Icon: UserIcon },
];

const PANEL_W = Math.min(320, Math.round(Dimensions.get('window').width * 0.82));

/**
 * Slide-in navigation drawer that replaces the bottom tab bar. The hamburger
 * button lives in the top bar (see TopBar); this owns the overlay + open/close
 * animation. `open` drives it; the panel animates out before unmounting.
 */
export default function NavDrawer({ open, onClose, active, onChange, isDriver = false }) {
  const items = NAV.filter((t) => t.id !== 'wallet' || isDriver);
  const [visible, setVisible] = useState(open);
  const slide = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (visible) {
      Animated.timing(slide, { toValue: 0, duration: 170, useNativeDriver: true }).start(
        ({ finished }) => { if (finished) setVisible(false); },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-PANEL_W, 0] });

  const select = (id) => {
    onChange(id);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <View style={styles.head}>
          <Text style={styles.brand}>Menu</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <CloseIcon size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {items.map((t) => {
            const isActive = t.id === active;
            const Icon = t.Icon;
            return (
              <Pressable
                key={t.id}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() => select(t.id)}
              >
                <View style={styles.iconBox}>
                  <Icon size={22} color={isActive ? colors.primary : colors.textMuted} />
                </View>
                <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_W,
    backgroundColor: colors.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: STATUS_TOP_PAD + 18,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  brand: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  rowActive: { backgroundColor: colors.primarySoft },
  iconBox: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  rowLabelActive: { color: colors.text, fontWeight: '700' },
});
