import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { useAppTheme, useThemedStyles, type AppColors, type AppShadows } from '@/src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ReviewResultScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ deckId: string; deckTitle: string; total: string; again: string; hard: string; easy: string }>(); const router = useRouter();
  const rows = [{ label: 'Dễ', value: params.easy, color: colors.success }, { label: 'Khó', value: params.hard, color: colors.warning }, { label: 'Không nhớ', value: params.again, color: colors.danger }];
  return <AppScreen contentStyle={styles.screen}><View style={styles.icon}><Ionicons name="trophy" size={52} color={colors.warning} /></View><Text style={styles.title}>Hoàn thành phiên học!</Text><Text style={styles.subtitle}>Bạn vừa ôn {params.total} thẻ trong “{params.deckTitle}”.</Text><View style={styles.card}>{rows.map((row) => <View key={row.label} style={styles.row}><View style={[styles.dot, { backgroundColor: row.color }]} /><Text style={styles.label}>{row.label}</Text><Text style={[styles.value, { color: row.color }]}>{row.value}</Text></View>)}</View><AppButton title="Về trang chủ" onPress={() => router.replace('/(tabs)')} /><AppButton title="Xem bộ từ" variant="ghost" onPress={() => router.replace(`/deck/${params.deckId}`)} /></AppScreen>;
}

const createStyles = (colors: AppColors, shadows: AppShadows) => StyleSheet.create({ screen: { flexGrow: 1, justifyContent: 'center', alignItems: 'stretch' }, icon: { alignSelf: 'center', width: 100, height: 100, borderRadius: 35, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }, subtitle: { color: colors.muted, lineHeight: 22, textAlign: 'center' }, card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 17, ...shadows.card }, row: { flexDirection: 'row', alignItems: 'center' }, dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 }, label: { flex: 1, color: colors.text, fontWeight: '700' }, value: { fontSize: 19, fontWeight: '900' } });
