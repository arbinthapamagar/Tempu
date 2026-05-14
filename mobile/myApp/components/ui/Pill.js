import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

const TONE = {
  success: { bg: colors.primarySoft, fg: colors.primaryDark, dot: colors.primary },
  warn: { bg: colors.warnSoft, fg: '#9a6b1f', dot: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  neutral: { bg: colors.surfaceMuted, fg: colors.textMuted, dot: colors.textFaint },
};

export default function Pill({ label, tone = 'neutral', showDot = false }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      {showDot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...type.micro, textTransform: 'capitalize' },
});
