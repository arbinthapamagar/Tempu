import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme';

/**
 * Card-style section with an UPPERCASE title above the card body.
 * Pass `collapsible` to make the header tappable.
 */
export default function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const header = collapsible ? (
    <Pressable
      style={styles.headerToggle}
      onPress={() => setOpen((v) => !v)}
      hitSlop={6}
    >
      <Text style={styles.title}>{title}</Text>
      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.textMuted}
      />
    </Pressable>
  ) : (
    <Text style={styles.title}>{title}</Text>
  );

  return (
    <View style={styles.wrap}>
      {header}
      {(!collapsible || open) && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
  body: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
