import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow, spacing } from '../../theme';

export default function BrandLogo() {
  return (
    <View style={styles.row}>
      <View style={styles.bolt}>
        <Ionicons name="flash" size={20} color="#ffffff" />
      </View>
      <Text style={styles.text}>
        Ev<Text style={styles.dark}>Nepal</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  bolt: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  dark: { color: colors.text },
});
