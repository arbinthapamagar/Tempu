import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supportPublicApi } from '../api/support.api';
import { Button, FormField, ScreenHeader } from '../components/ui';
import { colors, radius, spacing, type } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pre-login "Contact us" — anyone (no account) can reach the team; we reply by email.
export default function ContactSupportScreen({ onBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = EMAIL_RE.test(email.trim()) && message.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await supportPublicApi.contact({ name: name.trim(), email: email.trim(), message: message.trim() });
      setSent(true);
    } catch (e) {
      // Surface a soft inline error rather than crashing the pre-login flow.
      setSent(false);
      setMessage((m) => m); // no-op to keep state; show alert instead
      alert(e?.message || 'Could not send right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Contact us"
        left={<Pressable onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>}
      />

      {sent ? (
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Message sent</Text>
          <Text style={styles.successText}>
            Thanks for reaching out. Our team will get back to you over email at {email.trim()}.
          </Text>
          <Button label="Done" onPress={onBack} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.lead}>
              Have a question or need help before signing up? Send us a message and we’ll reply by email.
            </Text>

            <FormField label="Your name (optional)" value={name} onChangeText={setName} placeholder="e.g. Aarav Shrestha" />
            <View style={{ height: spacing.md }} />
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ height: spacing.md }} />
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="How can we help?"
              placeholderTextColor={colors.textFaint}
              style={styles.textarea}
            />

            <View style={{ height: spacing.lg }} />
            <Button label={busy ? 'Sending…' : 'Send message'} onPress={submit} disabled={!canSend} />
            {busy && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl },
  lead: { ...type.body, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 22 },
  fieldLabel: { ...type.eyebrow, color: colors.textMuted, marginBottom: 6 },
  textarea: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 130, textAlignVertical: 'top', ...type.body, color: colors.text,
  },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  successIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  successTitle: { ...type.h2, color: colors.text, marginBottom: spacing.sm },
  successText: { ...type.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
