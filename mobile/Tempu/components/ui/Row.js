import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Pill from './Pill';
import { colors, spacing, type } from '../../theme';

/**
 * A horizontal row used inside a Section body.
 * - `value` + optional `badge` for display rows
 * - `onPress` + chevron for tappable links
 */
export default function Row({
  label,
  value,
  badge,
  badgeTone = 'neutral',
  onPress,
  trailing,
  last = false,
}) {
  const tappable = !!onPress;
  const Container = tappable ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={[styles.wrap, last && styles.last]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value != null && (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        )}
        {badge && <Pill label={badge} tone={badgeTone} />}
        {trailing}
        {tappable && !trailing && (
          <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  last: { borderBottomWidth: 0 },
  label: { ...type.small, color: colors.textMuted },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '65%',
  },
  value: { ...type.bodyBold, color: colors.text, fontWeight: '600' },
});
