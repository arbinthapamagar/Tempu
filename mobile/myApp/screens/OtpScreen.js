import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const OTP_LENGTH = 6;

export default function OtpScreen({ phone, onSuccess, onBack }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const refs = useRef([]);

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const focusNext = (index) => refs.current[index + 1]?.focus();
  const focusPrev = (index) => refs.current[index - 1]?.focus();

  const handleChange = (val, index) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned) focusNext(index);
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !digits[index]) focusPrev(index);
  };

  const handlePaste = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (cleaned.length === OTP_LENGTH) {
      setDigits(cleaned.split(''));
      refs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits.`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await verifyOtp(otp);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendOtp();
      setResendCooldown(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      refs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
    }
  };

  const filled = digits.join('').length;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={12}>
          <View style={styles.backArrow} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.brand}>Tempu</Text>
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent{phone ? ` to ${phone}` : ''}.
          </Text>
        </View>

        <View style={styles.boxRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => (refs.current[i] = r)}
              value={d}
              onChangeText={(v) => {
                if (v.length > 1) handlePaste(v);
                else handleChange(v, i);
              }}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              style={[styles.box, d && styles.boxFilled, error && styles.boxError]}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              selectTextOnFocus
              textContentType="oneTimeCode"
              autoComplete={i === 0 ? 'sms-otp' : 'off'}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[
            styles.btn,
            filled < OTP_LENGTH && styles.btnDisabled,
            submitting && styles.btnDisabled,
          ]}
          onPress={handleVerify}
          disabled={filled < OTP_LENGTH || submitting}
        >
          <Text style={styles.btnText}>
            {submitting ? 'Verifying…' : 'Verify & continue'}
          </Text>
        </Pressable>

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive it?</Text>
          <Pressable onPress={handleResend} disabled={resendCooldown > 0} hitSlop={8}>
            <Text
              style={[styles.resendLink, resendCooldown > 0 && styles.resendDisabled]}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  header: { marginBottom: 40 },
  brand: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: '#fff0f0',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  resendLabel: { color: colors.textMuted, fontSize: 14 },
  resendLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: colors.textFaint },
});
