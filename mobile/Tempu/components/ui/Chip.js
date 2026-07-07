import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

/**
 * Selectable filter chip with an optional trailing count badge.
 */
export default function Chip({ label, count, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrap, active && styles.wrapActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {count != null && (
        <View style={[styles.count, active && styles.countActive]}>
          <Text style={[styles.countText, active && styles.countTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { ...type.small, color: colors.text, fontWeight: '700' },
  labelActive: { color: '#ffffff' },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  countText: { fontSize: 11, fontWeight: '800', color: colors.text },
  countTextActive: { color: '#ffffff' },
});
