import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authApi } from '../api/auth.api';
import OtpInput from '../components/OtpInput';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';

const OTP_LENGTH = 6;
const RESEND_AFTER_S = 60;

// Two steps against the existing backend flow:
//   1. POST /auth/forgot-password { phone } → SMS code + a 10-minute temp token
//   2. POST /auth/reset-password { otp, newPassword } with that token
export default function ForgotPasswordScreen({ initialPhone = '', onBack, onDone }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'reset'
  const [phone, setPhone] = useState(initialPhone);
  const [tempToken, setTempToken] = useState(null);
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const p = phone.trim();
    if (p.length < 10) {
      setError('Enter the phone number you signed up with.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(p);
      setTempToken(res.data?.tempToken || null);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_AFTER_S);
      setStep('reset');
      setTimeout(() => otpRef.current?.focus(0), 50);
    } catch (e) {
      setError(e?.message || 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code.`);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError('');
    setBusy(true);
    try {
      await authApi.resetPassword(otp, password, confirm, tempToken);
      Alert.alert('Password changed', 'Log in with your new password.');
      onDone?.();
    } catch (e) {
      const msg = e?.message || 'Could not reset the password.';
      // The temp token lives 10 minutes; past that the only way on is a new code.
      setError(/expired|temp token/i.test(msg) ? 'This code has expired. Send a new one.' : msg);
      if (/otp|code/i.test(msg)) setDigits(Array(OTP_LENGTH).fill(''));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (step === 'reset') {
      setStep('phone');
      setError('');
    } else {
      onBack?.();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} hitSlop={12} style={styles.back} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={styles.title}>Reset password</Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.sub}>We'll text a 6-digit code to your phone.</Text>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>+977</Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^\d]/g, ''))}
                placeholder="98XXXXXXXX"
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                autoFocus={!initialPhone}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={sendCode} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sub}>Code sent to {phone}.</Text>
            <OtpInput
              ref={otpRef}
              digits={digits}
              onChange={(d) => { setDigits(d); if (error) setError(''); }}
              error={!!error && /code/i.test(error)}
            />

            <Text style={styles.label}>New password</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Type it again"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={reset} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset password</Text>}
            </Pressable>

            <Pressable onPress={sendCode} disabled={cooldown > 0 || busy} style={styles.resend} hitSlop={8}>
              <Text style={[styles.resendText, cooldown > 0 && styles.resendWait]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: 'center', marginLeft: -8, marginBottom: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  prefix: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 16, color: colors.text, paddingVertical: 0 },
  toggle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginBottom: 12 },
  btn: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#ffffff' },
  resend: { alignSelf: 'center', marginTop: 18, padding: 4 },
  resendText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  resendWait: { color: colors.textMuted },
});
