import { useState } from 'react';
import {
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
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen({ onGoToRegister, onContact }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setError('');
    const trimmedPhone = phone.trim();

    if (!trimmedPhone || !password) {
      setError('Please enter your phone number and password.');
      return;
    }
    if (trimmedPhone.length < 7) {
      setError('That phone number looks too short.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedPhone, password);
      // AuthContext sets user → AppShell re-renders to main app
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Tempu</Text>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in with your phone number to continue.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98XXXXXXXX"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              style={styles.input}
              autoComplete="tel"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                autoComplete="password"
                editable={!submitting}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.toggle}
                hitSlop={8}
              >
                <Text style={styles.toggleText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            hitSlop={8}
            style={styles.forgotWrap}
            onPress={() =>
              Alert.alert(
                'Forgot Password',
                'Enter your registered phone number. An OTP will be sent to your email.',
                [{ text: 'OK' }],
              )
            }
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              submitting && styles.primaryButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Pressable onPress={onGoToRegister} hitSlop={8}>
            <Text style={styles.footerLink}>Create an account</Text>
          </Pressable>
        </View>

        {onContact && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Need help?</Text>
            <Pressable onPress={onContact} hitSlop={8}>
              <Text style={styles.footerLink}>Contact us</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
  },
  header: { marginBottom: 32 },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 24,
  },
  welcome: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  form: { marginBottom: 24 },
  field: { marginBottom: 18 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: { flex: 1, paddingRight: 60 },
  toggle: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 20 },
  forgot: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonPressed: { backgroundColor: colors.primaryDark },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
