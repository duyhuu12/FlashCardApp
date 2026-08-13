import { AppScreen } from '@/src/components/AppScreen';
import { ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { getLearningStats, listLeaderboard } from '@/src/services/deckService';
import { colors, shadows } from '@/src/theme/colors';
import type { LeaderboardEntry, LearningStats } from '@/src/types/models';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const emptyStats: LearningStats = { totalDecks: 0, totalCards: 0, mastered: 0, due: 0, learning: 0, reviewedLast7Days: 0 };

export default function StatsScreen() {
  const { user } = useAuth(); const [stats, setStats] = useState(emptyStats); const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return; setLoading(true); setError('');
    try {
      const nextStats = await getLearningStats(user.uid); setStats(nextStats);
      listLeaderboard().then(setLeaders).catch(() => setLeaders([]));
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <AppScreen><LoadingView message="Đang tổng hợp tiến độ..." /></AppScreen>;
  if (error) return <AppScreen><ErrorView message={error} onRetry={load} /></AppScreen>;
  const percent = stats.totalCards ? Math.round((stats.mastered / stats.totalCards) * 100) : 0;
  const cards = [
    { label: 'Đã thuộc', value: stats.mastered, icon: 'checkmark-circle' as const, color: colors.success, soft: colors.successSoft },
    { label: 'Cần ôn', value: stats.due, icon: 'time' as const, color: colors.danger, soft: colors.dangerSoft },
    { label: 'Đang học', value: stats.learning, icon: 'school' as const, color: colors.warning, soft: colors.warningSoft },
    { label: 'Từ mới', value: stats.newAvailable ?? 0, icon: 'sparkles' as const, color: colors.primary, soft: colors.primarySoft },
  ];
  const achievements = [
    { title: 'Bước đầu tiên', detail: 'Hoàn thành phiên học đầu', unlocked: (stats.reviewedLast7Days ?? 0) > 0, icon: 'footsteps' as const },
    { title: 'Bền bỉ 3 ngày', detail: 'Duy trì streak 3 ngày', unlocked: (stats.streak ?? 0) >= 3, icon: 'flame' as const },
    { title: '100 XP', detail: 'Tích lũy 100 điểm', unlocked: (stats.xp ?? 0) >= 100, icon: 'star' as const },
    { title: 'Bậc thầy 50 từ', detail: 'Thuộc ít nhất 50 từ', unlocked: stats.mastered >= 50, icon: 'ribbon' as const },
  ];

  return <AppScreen contentStyle={styles.screen}>
    <Text style={styles.title}>Tiến độ học tập</Text>
    <View style={styles.hero}><View style={styles.circle}><Text style={styles.percent}>{percent}%</Text><Text style={styles.small}>đã thuộc</Text></View><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{stats.xp ?? 0} XP</Text><Text style={styles.heroText}>{stats.streak ?? 0} ngày liên tiếp · {stats.reviewedToday ?? 0}/{stats.dailyGoal ?? 30} thẻ hôm nay</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, ((stats.reviewedToday ?? 0) / (stats.dailyGoal ?? 30)) * 100)}%` }]} /></View></View></View>
    <View style={styles.grid}>{cards.map((card) => <View key={card.label} style={styles.stat}><View style={[styles.statIcon, { backgroundColor: card.soft }]}><Ionicons name={card.icon} size={24} color={card.color} /></View><Text style={styles.statValue}>{card.value.toLocaleString('vi-VN')}</Text><Text style={styles.statLabel}>{card.label}</Text></View>)}</View>

    <Text style={styles.sectionTitle}>Thành tích</Text>
    <View style={styles.achievementList}>{achievements.map((item) => <View key={item.title} style={[styles.achievement, !item.unlocked && styles.locked]}><View style={[styles.badge, { backgroundColor: item.unlocked ? colors.warningSoft : colors.border }]}><Ionicons name={item.unlocked ? item.icon : 'lock-closed'} size={24} color={item.unlocked ? colors.warning : colors.muted} /></View><View style={{ flex: 1 }}><Text style={styles.achievementTitle}>{item.title}</Text><Text style={styles.achievementDetail}>{item.detail}</Text></View>{item.unlocked ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}</View>)}</View>

    <Text style={styles.sectionTitle}>Bảng xếp hạng XP</Text>
    {leaders.length === 0 ? <View style={styles.info}><Ionicons name="information-circle" size={22} color={colors.primary} /><Text style={styles.infoText}>Triển khai Firestore Rules mới để kích hoạt bảng xếp hạng.</Text></View> : <View style={styles.leaderboard}>{leaders.map((entry, index) => <View key={entry.uid} style={[styles.leader, entry.uid === user?.uid && styles.me]}><Text style={styles.rank}>{index + 1}</Text><View style={styles.avatar}><Text style={styles.avatarText}>{entry.displayName.charAt(0).toUpperCase()}</Text></View><Text style={styles.leaderName}>{entry.uid === user?.uid ? 'Bạn' : entry.displayName}</Text><Text style={styles.leaderXp}>{entry.xp} XP</Text></View>)}</View>}
  </AppScreen>;
}

const styles = StyleSheet.create({ screen: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 36 }, title: { color: colors.text, fontSize: 25, fontWeight: '900' }, hero: { flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: colors.surface, borderRadius: 22, padding: 20, ...shadows.card }, circle: { width: 95, height: 95, borderRadius: 48, borderWidth: 9, borderColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, percent: { color: colors.primary, fontSize: 24, fontWeight: '900' }, small: { color: colors.muted, fontSize: 11 }, heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900' }, heroText: { color: colors.muted, marginTop: 5, lineHeight: 19 }, track: { height: 8, backgroundColor: colors.border, borderRadius: 10, marginTop: 14, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stat: { width: '48%', backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 6, ...shadows.card }, statIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, statValue: { color: colors.text, fontSize: 25, fontWeight: '900' }, statLabel: { color: colors.muted }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 5 }, achievementList: { gap: 9 }, achievement: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 17, backgroundColor: colors.surface }, locked: { opacity: 0.58 }, badge: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, achievementTitle: { color: colors.text, fontWeight: '900' }, achievementDetail: { color: colors.muted, fontSize: 12, marginTop: 3 }, leaderboard: { borderRadius: 19, overflow: 'hidden', backgroundColor: colors.surface }, leader: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, me: { backgroundColor: colors.primarySoft }, rank: { width: 22, color: colors.primary, fontWeight: '900' }, avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, avatarText: { color: '#fff', fontWeight: '900' }, leaderName: { flex: 1, color: colors.text, fontWeight: '800' }, leaderXp: { color: colors.warning, fontWeight: '900' }, info: { flexDirection: 'row', gap: 9, padding: 14, borderRadius: 16, backgroundColor: colors.primarySoft }, infoText: { flex: 1, color: colors.text, lineHeight: 19 } });
