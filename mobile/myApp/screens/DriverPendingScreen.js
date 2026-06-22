import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function DriverPendingScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🎉</Text>
        </View>

        <Text style={styles.title}>Application submitted!</Text>
        <Text style={styles.body}>
          Your driver application has been received. Our team will review your vehicle and license
          details within 24 hours.
        </Text>

        <View style={styles.steps}>
          {[
            { emoji: '✅', text: 'Account created' },
            { emoji: '⏳', text: 'Documents under review', active: true },
            { emoji: '🔔', text: 'You\'ll be notified once approved' },
          ].map((s, i) => (
            <View key={i} style={[styles.step, s.active && styles.stepActive]}>
              <Text style={styles.stepEmoji}>{s.emoji}</Text>
              <Text style={[styles.stepText, s.active && styles.stepTextActive]}>{s.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Once approved, you can log back in and start accepting rides.
        </Text>

        <Pressable style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  icon: { fontSize: 40 },

  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },

  steps: {
    width: '100%',
    gap: 10,
    marginBottom: 28,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepActive: {
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
  },
  stepEmoji: { fontSize: 20 },
  stepText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  stepTextActive: { color: colors.warn, fontWeight: '700' },

  note: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 18,
  },

  btn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
