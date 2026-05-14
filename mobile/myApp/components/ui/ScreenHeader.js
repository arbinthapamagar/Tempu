import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, STATUS_TOP_PAD, type } from '../../theme';

/**
 * Standard top header. Bakes the Android status-bar inset so callers don't
 * have to repeat `Platform.OS === 'android' ? ...` per screen.
 */
export default function ScreenHeader({ title, left, right, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.side}>{left}</View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const SIDE_MIN = 40;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: STATUS_TOP_PAD,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  side: {
    minWidth: SIDE_MIN,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: { justifyContent: 'flex-end' },
  title: { ...type.h2, color: colors.text },
});
