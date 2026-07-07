import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme';

export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure,
  autoCapitalize = 'sentences',
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
});
