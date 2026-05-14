import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

const VARIANT = {
  primary: { bg: colors.primary, pressedBg: colors.primaryDark, fg: '#ffffff' },
  secondary: {
    bg: colors.surfaceMuted,
    pressedBg: colors.divider,
    fg: colors.text,
    border: colors.border,
  },
  ghost: { bg: 'transparent', pressedBg: colors.surfaceMuted, fg: colors.text },
  danger: { bg: colors.dangerSoft, pressedBg: '#f5d4d4', fg: colors.danger },
};

const SIZE = {
  md: { paddingVertical: 14, fontSize: 15 },
  sm: { paddingVertical: 10, fontSize: 13 },
};

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  onPress,
  disabled,
  style,
}) {
  const v = VARIANT[variant] || VARIANT.primary;
  const s = SIZE[size] || SIZE.md;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed && !disabled ? v.pressedBg : v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        { paddingVertical: s.paddingVertical },
        disabled && styles.disabled,
        style,
      ]}
    >
      {leftIcon ? <View style={styles.iconL}>{leftIcon}</View> : null}
      <Text style={[styles.label, { color: v.fg, fontSize: s.fontSize }]}>
        {label}
      </Text>
      {rightIcon ? <View style={styles.iconR}>{rightIcon}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  label: { ...type.bodyBold, fontWeight: '800' },
  iconL: {},
  iconR: {},
  disabled: { opacity: 0.5 },
});
