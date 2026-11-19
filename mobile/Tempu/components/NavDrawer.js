import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
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
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { STATUS_TOP_PAD } from '../theme';
import { fonts } from '../theme/type';

const NAV = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'trips', label: 'Trips', Icon: DocIcon },
  { id: 'subscribe', label: 'Subscribe', Icon: CardIcon },
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
  const items = NAV;
  const { user } = useAuth();
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const balance = Number(user?.walletBalance || 0);
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
        {/* Who is signed in, and their balance; tapping opens Account. */}
        <View style={styles.head}>
          <Pressable style={styles.who} onPress={() => select('account')}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{user?.name || 'Account'}</Text>
              {user?.phone ? <Text style={styles.phone} numberOfLines={1}>{user.phone}</Text> : null}
            </View>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close menu">
            <CloseIcon size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        <Pressable style={styles.balanceRow} onPress={() => select('account')}>
          <Text style={styles.balanceLabel}>Wallet</Text>
          <Text style={styles.balanceValue}>Rs {balance.toLocaleString()}</Text>
        </Pressable>

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
    paddingTop: STATUS_TOP_PAD + 18,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
  name: { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.text },
  phone: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 1 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  balanceLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted },
  balanceValue: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
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
    borderRadius: 8,
  },
  rowActive: { backgroundColor: colors.primarySoft },
  iconBox: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontFamily: fonts.bodySemibold, color: colors.textMuted },
  rowLabelActive: { color: colors.text, fontFamily: fonts.bodyBold },
});
