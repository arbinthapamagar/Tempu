import { StyleSheet, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';

/**
 * Bottom-sheet shell with the grab handle baked in. Pass `tall` to cap height
 * at 88% of the parent.
 */
export default function Sheet({ children, tall = false, style }) {
  return (
    <View style={[styles.sheet, tall && styles.tall, style]}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl + 2,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xxl + 4,
    ...shadow.sheet,
  },
  tall: { maxHeight: '88%' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cdd2cd',
    marginBottom: spacing.lg,
  },
});
