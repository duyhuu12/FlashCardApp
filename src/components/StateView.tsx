import { AppButton } from '@/src/components/AppButton';
import { colors } from '@/src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingView({ message = 'Đang tải dữ liệu...' }: { message?: string }) {
  return <View style={styles.box}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.message}>{message}</Text></View>;
}

export function EmptyView({ title, message, actionTitle, onAction }: { title: string; message: string; actionTitle?: string; onAction?: () => void }) {
  return <View style={styles.box}><Ionicons name="albums-outline" size={48} color={colors.primary} /><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>{actionTitle && onAction ? <AppButton title={actionTitle} onPress={onAction} /> : null}</View>;
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.box}><Ionicons name="cloud-offline-outline" size={48} color={colors.danger} /><Text style={styles.title}>Không tải được dữ liệu</Text><Text style={styles.message}>{message}</Text>{onRetry ? <AppButton title="Thử lại" onPress={onRetry} variant="secondary" /> : null}</View>;
}

const styles = StyleSheet.create({
  box: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
