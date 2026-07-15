import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supportPublicApi } from '../api/support.api';
import RatingCard from '../components/RatingCard';
import { Button, FormField, ScreenHeader } from '../components/ui';
import { colors, radius, spacing, type } from '../theme';
import { fonts } from '../theme/type';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_KEY = 'guest_support_chat'; // { id, token }

// Pre-login support live chat - anyone (no account) can start a thread and chat
// with the team in real time. The thread is remembered on-device so they can
// come back to it; we identify it by a token, not a login.
export default function ContactSupportScreen({ onBack }) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'intro' | 'chat'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Active chat
  const [chat, setChat] = useState(null); // { id, token }
  const [ticket, setTicket] = useState(null); // { messages, status, ... }
  const [reply, setReply] = useState('');
  const scrollRef = useRef(null);

  const canStart = EMAIL_RE.test(email.trim()) && message.trim().length > 0 && !busy;

  // Resume an existing thread if we opened one before.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const res = await supportPublicApi.getChat(saved.id, saved.token);
          setChat(saved);
          setTicket(res.data);
          setPhase('chat');
          return;
        }
      } catch { /* stale/closed token - fall back to a fresh enquiry */ }
      setPhase('intro');
    })();
  }, []);

  // Live-refresh the thread so admin replies appear without a manual refresh.
  const refresh = useCallback(async () => {
    if (!chat) return;
    try {
      const res = await supportPublicApi.getChat(chat.id, chat.token);
      setTicket(res.data);
    } catch { /* ignore poll errors */ }
  }, [chat]);

  useEffect(() => {
    if (phase !== 'chat' || !chat) return undefined;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [phase, chat, refresh]);

  const startChat = async () => {
    if (!canStart) return;
    setBusy(true);
    try {
      const res = await supportPublicApi.startChat({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      const saved = { id: res.data.ticket._id, token: res.data.token };
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(saved));
      setChat(saved);
      setTicket(res.data.ticket);
      setMessage('');
      setPhase('chat');
    } catch (e) {
      Alert.alert('Could not start chat', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !chat || busy) return;
    setBusy(true);
    setReply('');
    try {
      const res = await supportPublicApi.sendChatMessage(chat.id, chat.token, text);
      setTicket(res.data);
    } catch (e) {
      setReply(text); // restore so the user doesn't lose their message
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async ({ score, note, tags }) => {
    if (!chat || busy) return;
    setBusy(true);
    try {
      const res = await supportPublicApi.rateChat(chat.id, chat.token, score, note, tags);
      setTicket(res.data);
    } catch (e) {
      Alert.alert('Could not submit rating', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const endChat = () => {
    Alert.alert('Start a new chat?', 'This clears the current conversation from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New chat',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORE_KEY);
          setChat(null);
          setTicket(null);
          setPhase('intro');
        },
      },
    ]);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Contact us"
          left={<Pressable onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>}
        />
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  if (phase === 'chat') {
    const messages = ticket?.messages || [];
    const closed = ticket?.status === 'closed';
    const agentName = ticket?.assignedTo?.name || null;
    const resolvedOrClosed = ticket?.status === 'resolved' || ticket?.status === 'closed';
    const canRate = resolvedOrClosed && !ticket?.rating?.score;
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Support chat"
          left={<Pressable onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>}
          right={<Pressable onPress={endChat} hitSlop={8}><Ionicons name="create-outline" size={22} color={colors.primary} /></Pressable>}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <View style={styles.introNote}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textMuted} />
              <Text style={styles.introNoteText}>
                {agentName
                  ? `You're chatting with ${agentName} from the Tempu team. Replies appear here in real time.`
                  : `You're chatting with the Tempu team as ${ticket?.guest?.email || 'a guest'}. Replies appear here in real time.`}
              </Text>
            </View>
            {messages.map((m, i) => {
              const mine = m.senderType !== 'admin';
              const senderLabel = mine ? 'You' : m.isAI ? 'AI Assistant' : (agentName || 'Support');
              return (
                <View key={i} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAdmin]}>
                  <Text style={[styles.bubbleSender, mine && { color: 'rgba(255,255,255,0.85)' }]}>
                    {senderLabel}
                  </Text>
                  <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{m.message}</Text>
                </View>
              );
            })}

            {ticket?.rating?.score ? (
              <View style={styles.ratedNote}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.ratedText}>
                  You rated this support {ticket.rating.score}/5. Thank you!
                </Text>
              </View>
            ) : null}

            {canRate && (
              <RatingCard agent={ticket?.assignedTo} busy={busy} onSubmit={submitRating} />
            )}
          </ScrollView>

          {closed && (
            <View style={styles.reopenBar}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.reopenText}>This chat is closed - send a message to reopen it.</Text>
            </View>
          )}

          <View style={styles.replyBar}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Type a message…"
              placeholderTextColor={colors.textFaint}
              style={styles.replyInput}
              multiline
            />
            <Pressable onPress={sendReply} disabled={busy || !reply.trim()} style={[styles.sendBtn, (busy || !reply.trim()) && { opacity: 0.5 }]}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Intro (start a chat) ────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Contact us"
        left={<Pressable onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            Have a question before signing up? Start a chat with our team - no account needed.
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
          <Button label={busy ? 'Starting…' : 'Start chat'} onPress={startChat} disabled={!canStart} />
          {busy && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  lead: { ...type.body, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 22 },
  fieldLabel: { ...type.eyebrow, color: colors.textMuted, marginBottom: 6 },
  textarea: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 130, textAlignVertical: 'top', ...type.body, color: colors.text,
  },

  introNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  introNoteText: { flex: 1, ...type.caption, color: colors.textMuted, lineHeight: 17 },

  bubble: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, maxWidth: '85%' },
  bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  bubbleAdmin: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  bubbleSender: { ...type.micro, color: colors.textMuted, marginBottom: 2, fontFamily: fonts.mono },
  bubbleText: { ...type.body, color: colors.text },

  reopenBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primarySoft,
  },
  reopenText: { ...type.caption, color: colors.primary, fontWeight: '700', flexShrink: 1 },

  ratedNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  ratedText: { ...type.caption, color: colors.textMuted, flexShrink: 1 },

  rateCard: {
    marginTop: spacing.lg, padding: spacing.lg, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  rateTitle: { ...type.body, color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  rateHint: { ...type.micro, color: colors.textFaint, marginTop: spacing.sm },
  rateNote: {
    marginTop: spacing.md, alignSelf: 'stretch', minHeight: 64,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...type.body, color: colors.text, textAlignVertical: 'top',
  },

  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  replyInput: {
    flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...type.body, color: colors.text,
    maxHeight: 120,
  },
  sendBtn: { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
