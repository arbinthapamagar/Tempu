import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, radius, spacing, type } from '../theme';

// Dynamic headline under the stars, keyed by the selected score.
const SUBTITLE = {
  0: 'Tap a star to rate',
  1: 'Poor experience',
  2: 'Could be better',
  3: 'It was okay',
  4: 'Good, but can be better!',
  5: 'Excellent support!',
};

// Quick-pick feedback tags the customer can select before submitting.
const TAGS = ['Helpful', 'Fast response', 'Polite', 'Knowledgeable', 'Patient', 'Clear', 'Other'];

const ROLE_LABEL = {
  moderator: 'Support Agent',
  admin: 'Support Lead',
  headmaster: 'Support Lead',
  superadmin: 'Support Manager',
};

// A ride-hailing-style rating card for support. Manages its own score/tags/note
// and hands the result back via onSubmit({ score, note, tags }).
export default function RatingCard({ agent, busy, onSubmit }) {
  const [score, setScore] = useState(0);
  const [tags, setTags] = useState([]);
  const [note, setNote] = useState('');

  const name = agent?.name || 'our support team';
  const designation = ROLE_LABEL[agent?.role] || 'Support Agent';
  const initials = (agent?.name || 'S').trim().charAt(0).toUpperCase();

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = () => {
    if (score < 1 || busy) return;
    onSubmit({ score, note: note.trim(), tags });
  };

  return (
    <View style={styles.card}>
      {agent?.avatarUrl ? (
        <Image source={{ uri: agent.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}

      <Text style={styles.title}>Rate {name}</Text>
      <Text style={styles.designation}>{designation}</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} disabled={busy} hitSlop={6}>
            <Ionicons
              name={n <= score ? 'star' : 'star-outline'}
              size={40}
              color={colors.primary}
              style={{ marginHorizontal: 4 }}
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.subtitle}>{SUBTITLE[score]}</Text>

      <View style={styles.tags}>
        {TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <Pressable key={t} onPress={() => toggleTag(t)} disabled={busy} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note (optional)"
        placeholderTextColor={colors.textFaint}
        style={styles.note}
        multiline
      />

      <Button
        label={busy ? 'Submitting…' : 'Done'}
        onPress={submit}
        disabled={busy || score < 1}
        style={{ alignSelf: 'stretch', marginTop: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg, padding: spacing.lg, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: spacing.sm, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { ...type.body, color: colors.textMuted, fontWeight: '700', fontSize: 24 },
  title: { ...type.body, color: colors.text, fontWeight: '700', textAlign: 'center' },
  designation: { ...type.caption, color: colors.textMuted, marginBottom: spacing.md },
  stars: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  subtitle: { ...type.caption, color: colors.primary, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.caption, color: colors.textMuted },
  chipTextOn: { color: colors.primary, fontWeight: '700' },
  note: {
    marginTop: spacing.md, alignSelf: 'stretch', minHeight: 64,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...type.body, color: colors.text, textAlignVertical: 'top',
  },
});
