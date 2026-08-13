import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { getCard, getCardProgress, getDeck, setCardFavorite } from '@/src/services/deckService';
import { speakEnglish, stopSpeaking } from '@/src/services/speechService';
import { colors, shadows } from '@/src/theme/colors';
import type { CardProgress, Deck, Flashcard } from '@/src/types/models';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

function learningStatus(progress: CardProgress | null) {
  if (!progress?.lastReviewedAt) return { label: 'Chưa học', icon: 'sparkles-outline' as const, color: colors.primary, soft: colors.primarySoft };
  if (progress.mastered) return { label: 'Đã thuộc', icon: 'checkmark-circle-outline' as const, color: colors.success, soft: colors.successSoft };
  if (progress.lastRating === 'again' || progress.lastRating === 'hard') return { label: 'Từ khó', icon: 'alert-circle-outline' as const, color: colors.warning, soft: colors.warningSoft };
  return { label: 'Đang học', icon: 'time-outline' as const, color: colors.primary, soft: colors.primarySoft };
}

export default function WordDetailScreen() {
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [card, setCard] = useState<Flashcard | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [progress, setProgress] = useState<CardProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !deckId || !cardId) return;
    setLoading(true);
    setError('');
    try {
      const [nextCard, nextDeck, nextProgress] = await Promise.all([
        getCard(deckId, cardId),
        getDeck(deckId),
        getCardProgress(user.uid, cardId),
      ]);
      if (!nextCard || !nextDeck) throw new Error('Không tìm thấy từ vựng này.');
      setCard(nextCard);
      setDeck(nextDeck);
      setProgress(nextProgress);
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [cardId, deckId, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => () => { stopSpeaking().catch(() => undefined); }, []));

  const toggleFavorite = async () => {
    if (!user || !card || savingFavorite) return;
    const nextFavorite = !progress?.favorite;
    setSavingFavorite(true);
    setProgress((current) => current
      ? { ...current, favorite: nextFavorite }
      : {
        cardId: card.id, deckId: card.deckId, repetitions: 0, consecutiveCorrect: 0,
        intervalMinutes: 0, lastRating: null, lastReviewedAt: null, nextReviewAt: null,
        mastered: false, favorite: nextFavorite,
      });
    try {
      await setCardFavorite(user.uid, card.deckId, card.id, nextFavorite);
    } catch (favoriteError) {
      setProgress((current) => current ? { ...current, favorite: !nextFavorite } : null);
      Alert.alert('Không thể lưu yêu thích', friendlyError(favoriteError));
    } finally {
      setSavingFavorite(false);
    }
  };

  if (loading) return <AppScreen><LoadingView message="Đang tải chi tiết từ..." /></AppScreen>;
  if (error || !card || !deck) return <AppScreen><ErrorView message={error || 'Không tìm thấy từ.'} onRetry={load} /></AppScreen>;

  const status = learningStatus(progress);
  const isFavorite = Boolean(progress?.favorite);

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroActions}>
          <View style={[styles.statusBadge, { backgroundColor: status.soft }]}>
            <Ionicons name={status.icon} size={17} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Pressable
            accessibilityLabel={isFavorite ? 'Bỏ khỏi yêu thích' : 'Đánh dấu yêu thích'}
            accessibilityRole="button"
            disabled={savingFavorite}
            onPress={toggleFavorite}
            style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed, savingFavorite && styles.disabled]}>
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={27} color={isFavorite ? colors.danger : colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.term}>{card.term}</Text>
        {card.pronunciation ? <Text style={styles.pronunciation}>/{card.pronunciation}/</Text> : null}
        {card.partOfSpeech ? <Text style={styles.partOfSpeech}>{card.partOfSpeech}</Text> : null}
        <Pressable
          accessibilityLabel={`Phát âm ${card.term}`}
          accessibilityRole="button"
          onPress={() => speakEnglish(card.term).catch(() => undefined)}
          style={({ pressed }) => [styles.speakButton, pressed && styles.pressed]}>
          <Ionicons name="volume-high" size={22} color="#fff" />
          <Text style={styles.speakText}>Nghe phát âm</Text>
        </Pressable>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.label}>NGHĨA TIẾNG VIỆT</Text>
        <Text style={styles.meaning}>{card.meaning}</Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.label}>VÍ DỤ</Text>
        <Text style={card.example ? styles.example : styles.missingText}>
          {card.example || 'Từ này chưa có câu ví dụ.'}
        </Text>
      </View>

      <Pressable
        accessibilityHint="Mở chủ đề chứa từ này"
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/deck/[id]', params: { id: deck.id } })}
        style={({ pressed }) => [styles.topicCard, pressed && styles.pressed]}>
        <View style={styles.topicIcon}><Ionicons name="book-outline" size={23} color={colors.primary} /></View>
        <View style={styles.topicCopy}>
          <Text style={styles.label}>THUỘC CHỦ ĐỀ</Text>
          <Text style={styles.topicTitle}>{deck.title}</Text>
          <Text style={styles.topicMeta}>Bài {deck.topicOrder ?? '—'} · {deck.cardCount} từ</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <View style={styles.actions}>
        <AppButton title="Học chủ đề này" onPress={() => router.push({ pathname: '/review/[deckId]', params: { deckId: deck.id, mode: 'daily' } })} style={styles.actionButton} />
        <AppButton title="Xem danh sách từ" variant="secondary" onPress={() => router.push({ pathname: '/deck/[id]', params: { id: deck.id } })} style={styles.actionButton} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 34 },
  hero: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 26, backgroundColor: colors.surface, ...shadows.card },
  heroActions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13 },
  statusText: { fontSize: 12, fontWeight: '900' },
  favoriteButton: { width: 49, height: 49, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  term: { color: colors.text, fontSize: 38, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  pronunciation: { color: colors.primary, fontSize: 18 },
  partOfSpeech: { color: colors.muted, fontSize: 14, fontStyle: 'italic' },
  speakButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, borderRadius: 15, backgroundColor: colors.primary, marginTop: 12 },
  speakText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  detailCard: { gap: 9, padding: 18, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  label: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  meaning: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 32 },
  example: { color: colors.text, fontSize: 17, fontStyle: 'italic', lineHeight: 26 },
  missingText: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
  topicCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  topicIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  topicCopy: { flex: 1, gap: 3 },
  topicTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  topicMeta: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
});
