import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';

// Where the application stands. It really is a sequence, so it is shown as
// one: done / in progress / still to come.
const STEPS = [
  { state: 'done', text: 'Account created' },
  { state: 'active', text: 'Documents under review (usually within 24 hours)' },
  { state: 'todo', text: 'Approval — we\'ll notify you' },
];

const STEP_ICON = {
  done: { name: 'checkmark-circle', color: colors.success },
  active: { name: 'time', color: colors.warn },
  todo: { name: 'ellipse-outline', color: colors.textFaint },
};

export default function DriverPendingScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.title}>Application sent</Text>
        <Text style={styles.body}>
          We're checking your vehicle and licence details. You can start taking rides once
          it's approved.
        </Text>

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.text} style={[styles.step, i === STEPS.length - 1 && styles.stepLast]}>
              <Ionicons name={STEP_ICON[s.state].name} size={20} color={STEP_ICON[s.state].color} />
              <Text style={[styles.stepText, s.state === 'active' && styles.stepTextActive]}>
                {s.text}
              </Text>
            </View>
          ))}
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
  },

  title: {
    color: colors.text,
    fontSize: 26,
    fontFamily: fonts.display,
    marginBottom: 8,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: fonts.body,
    lineHeight: 22,
    marginBottom: 24,
  },

  steps: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  stepLast: { borderBottomWidth: 0 },
  stepText: { flex: 1, color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  stepTextActive: { color: colors.text, fontFamily: fonts.bodySemibold },

  btn: {
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  btnText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemibold },
});
