import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../../theme';

/**
 * Round button (back, close, recenter, etc.) — soft surface with optional elevation.
 */
export default function IconButton({
  children,
  onPress,
  size = 40,
  elevated = false,
  surface = colors.surfaceMuted,
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: surface },
        elevated && shadow.fab,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
