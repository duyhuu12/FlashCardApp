import { useAppTheme, useThemedStyles, type AppColors } from '@/src/theme/colors';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export function AppInput({ label, error, multiline, ...props }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  group: { gap: 7 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13 },
});
