import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

export default function RoleSelectScreen({ onPassenger, onDriver, onSignIn, onContact }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Tempu</Text>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>How would you like to use Tempu?</Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardPassenger, pressed && styles.cardPressed]}
            onPress={onPassenger}
          >
            <Text style={styles.cardEmoji}>🛺</Text>
            <Text style={[styles.cardTitle, { color: colors.primaryDark }]}>I need a ride</Text>
            <Text style={styles.cardDesc}>Book rickshaws, scooters, bikes and taxis near you</Text>
            <View style={[styles.cardBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.cardBtnText}>Continue as Passenger</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, styles.cardDriver, pressed && styles.cardPressed]}
            onPress={onDriver}
          >
            <Text style={styles.cardEmoji}>🚗</Text>
            <Text style={[styles.cardTitle, { color: '#1a56db' }]}>I want to drive</Text>
            <Text style={styles.cardDesc}>Earn money by driving passengers around the city</Text>
            <View style={[styles.cardBtn, { backgroundColor: '#1a56db' }]}>
              <Text style={styles.cardBtnText}>Register as Driver</Text>
            </View>
          </Pressable>
        </View>

        {/* Sign in link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={onSignIn} hitSlop={8}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </View>

        {/* Pre-login help — no account needed */}
        {onContact && (
          <Pressable onPress={onContact} hitSlop={8} style={styles.contactRow}>
            <Text style={styles.contactText}>New here? </Text>
            <Text style={styles.footerLink}>Contact us</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  header: { marginBottom: 8 },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
  },

  cards: { flex: 1, justifyContent: 'center', gap: 14 },

  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
  },
  cardPassenger: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  cardDriver: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },

  cardEmoji: { fontSize: 40, marginBottom: 10 },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  cardBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
  },
  cardBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  contactRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 10 },
  contactText: { color: colors.textMuted, fontSize: 13 },
});
