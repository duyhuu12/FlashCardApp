import { colors } from '@/src/theme/colors';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

interface Props {
  title: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function AppButton({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const palette = {
    primary: { background: colors.primary, text: '#FFFFFF', border: colors.primary },
    secondary: { background: colors.primarySoft, text: colors.primaryDark, border: colors.primarySoft },
    danger: { background: colors.dangerSoft, text: colors.danger, border: colors.dangerSoft },
    ghost: { background: 'transparent', text: colors.text, border: colors.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={[styles.text, { color: palette.text }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  text: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});
