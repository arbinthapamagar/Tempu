import { useState } from 'react';
import {
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

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

export default function RegisterScreen({ onGoToLogin, onRegistered }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!name.trim()) return 'Please enter your full name.';
    if (!phone.trim()) return 'Phone number is required.';
    if (phone.trim().length < 7) return 'That phone number looks too short.';
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) return 'Email format does not look right.';
    }
    if (!gender) return 'Please choose a gender.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleRegister = async () => {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        gender,
        password,
        confirmPassword,
      });
      onRegistered(phone.trim());
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            It only takes a minute. Your phone number will be used to sign in.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoCapitalize="words"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98XXXXXXXX"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              style={styles.input}
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Email <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((opt) => {
                const selected = gender === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value)}
                    style={[styles.genderChip, selected && styles.genderChipSelected]}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        selected && styles.genderChipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
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

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              style={styles.input}
              editable={!submitting}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              submitting && styles.primaryButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={onGoToLogin} hitSlop={8}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header: { marginBottom: 24 },
  brand: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  form: { marginBottom: 16 },
  field: { marginBottom: 16 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  optional: {
    color: colors.textFaint,
    fontWeight: '400',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  genderChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  genderChipText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  genderChipTextSelected: { color: colors.primaryDark, fontWeight: '600' },
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
  toggleText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonPressed: { backgroundColor: colors.primaryDark },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  legal: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
