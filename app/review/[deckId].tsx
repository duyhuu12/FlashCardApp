import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { EmptyView, ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { ensureDeckProgress, getDeck, getStudyQueue, saveReview } from '@/src/services/deckService';
import { speakEnglish, stopSpeaking } from '@/src/services/speechService';
import { useAppTheme, useThemedStyles, type AppColors, type AppShadows } from '@/src/theme/colors';
import type { CardProgress, Deck, Flashcard, ReviewRating, ReviewSummary, StudyMode } from '@/src/types/models';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ReviewScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { deckId, mode = 'daily' } = useLocalSearchParams<{ deckId: string; mode?: StudyMode }>(); const { user } = useAuth(); const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null); const [queue, setQueue] = useState<Flashcard[]>([]); const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [index, setIndex] = useState(0); const [summary, setSummary] = useState<ReviewSummary>({ total: 0, again: 0, hard: 0, easy: 0 });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current; const position = useRef(new Animated.ValueXY()).current;

  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(''); try { const nextDeck = await getDeck(deckId); if (!nextDeck) throw new Error('Không tìm thấy bộ từ.'); await ensureDeckProgress(user.uid, deckId, nextDeck.cardCount); const session = await getStudyQueue(user.uid, deckId, mode, 30); setDeck(nextDeck); setProgress(session.progress); setQueue(session.cards); setIndex(0); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); } }, [deckId, mode, user]);
  useEffect(() => { load(); }, [load]);
  const spokenCard = queue[index];
  useEffect(() => {
    if (loading || !spokenCard) return;
    speakEnglish(spokenCard.term).catch(() => undefined);
    return () => { stopSpeaking().catch(() => undefined); };
  }, [loading, spokenCard]);

  function toggleFlip() { const next = !flipped; setFlipped(next); Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 10, useNativeDriver: true }).start(); }
  const rate = useCallback(async (rating: ReviewRating) => {
    const card = queue[index]; if (!card || !user || saving) return; setSaving(true);
    try {
      const nextProgress = await saveReview(user.uid, deckId, card.id, rating, progress[card.id]); setProgress((current) => ({ ...current, [card.id]: nextProgress }));
      const nextSummary = { ...summary, total: summary.total + 1, [rating]: summary[rating] + 1 }; setSummary(nextSummary);
      if (index + 1 >= queue.length) {
        router.replace({ pathname: '/review/result', params: { deckId, deckTitle: deck?.title || 'Bộ từ', ...Object.fromEntries(Object.entries(nextSummary).map(([key, value]) => [key, String(value)])) } });
      }
      else { setIndex((value) => value + 1); setFlipped(false); flip.setValue(0); position.setValue({ x: 0, y: 0 }); }
    } catch (e) { setError(friendlyError(e)); position.setValue({ x: 0, y: 0 }); } finally { setSaving(false); }
  }, [deck?.title, deckId, flip, index, position, progress, queue, router, saving, summary, user]);
  const animateRating = useCallback((rating: ReviewRating, x: number) => { Animated.timing(position, { toValue: { x, y: 0 }, duration: 180, useNativeDriver: true }).start(() => rate(rating)); }, [position, rate]);
  const panResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12, onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }), onPanResponderRelease: (_, gesture) => { if (gesture.dx > 100) animateRating('easy', SCREEN_WIDTH); else if (gesture.dx < -100) animateRating('again', -SCREEN_WIDTH); else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(); } }), [animateRating, position]);
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }); const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  if (loading) return <AppScreen><LoadingView message="Đang chuẩn bị phiên học cá nhân hóa..." /></AppScreen>;
  if (error && queue.length === 0) return <AppScreen><ErrorView message={error} onRetry={load} /></AppScreen>;
  if (queue.length === 0) return <AppScreen><EmptyView title="Không có thẻ phù hợp" message="Hãy chọn phiên học khác hoặc quay lại lộ trình." actionTitle="Về trang chủ" onAction={() => router.replace('/(tabs)')} /></AppScreen>;
  const card = queue[index];
  return <AppScreen scroll={false} contentStyle={styles.screen}>
    <View style={styles.progressRow}><Text style={styles.deckName} numberOfLines={1}>{deck?.title}</Text><Text style={styles.counter}>{index + 1}/{queue.length}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${((index + 1) / queue.length) * 100}%` }]} /></View>
    <Animated.View {...panResponder.panHandlers} style={[styles.cardArea, { transform: position.getTranslateTransform() }]}>
      <Pressable onPress={toggleFlip} style={styles.pressable}>
        <Animated.View style={[styles.flashcard, styles.face, { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] }]}><Text style={styles.faceLabel}>TỪ VỰNG</Text><Text style={styles.term}>{card.term}</Text>{card.pronunciation ? <Text style={styles.pronunciation}>/{card.pronunciation}/</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Phát âm ${card.term}`} hitSlop={10} onPress={(event) => { event.stopPropagation(); speakEnglish(card.term).catch(() => undefined); }} style={styles.frontSpeakerButton}><Ionicons name="volume-high" size={27} color={colors.primary} /></Pressable><View style={styles.tapHint}><Text style={styles.hint}>Chạm để xem nghĩa</Text></View></Animated.View>
        <Animated.View style={[styles.flashcard, styles.face, styles.back, { transform: [{ perspective: 1000 }, { rotateY: backRotate }] }]}><Text style={styles.faceLabel}>NGHĨA</Text>{card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.image} contentFit="cover" /> : null}<Text style={styles.meaning}>{card.meaning}</Text>{card.example ? <Text style={styles.example}>“{card.example}”</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Phát âm ${card.term}`} hitSlop={10} onPress={(event) => { event.stopPropagation(); speakEnglish(card.term).catch(() => undefined); }} style={styles.frontSpeakerButton}><Ionicons name="volume-high" size={27} color={colors.primary} /></Pressable><Text style={styles.hint}>Bạn nhớ từ này thế nào?</Text></Animated.View>
      </Pressable>
    </Animated.View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.ratingRow}><View style={styles.rating}><AppButton title="Rất khó" variant="danger" onPress={() => animateRating('again', -SCREEN_WIDTH)} disabled={saving} /><Text style={styles.interval}>10 phút</Text></View><View style={styles.rating}><AppButton title="Khó" variant="ghost" onPress={() => rate('hard')} disabled={saving} /><Text style={styles.interval}>≥ 1 ngày</Text></View><View style={styles.rating}><AppButton title="Dễ" variant="secondary" onPress={() => animateRating('easy', SCREEN_WIDTH)} disabled={saving} /><Text style={styles.interval}>≥ 3 ngày</Text></View></View>
    <Text style={styles.swipeHint}>Vuốt trái: không nhớ · Vuốt phải: dễ</Text>
  </AppScreen>;
}

const createStyles = (colors: AppColors, shadows: AppShadows) => StyleSheet.create({
  screen: { paddingBottom: 18 }, progressRow: { flexDirection: 'row', justifyContent: 'space-between' }, deckName: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' }, counter: { color: colors.primary, fontWeight: '900' }, track: { height: 7, borderRadius: 10, backgroundColor: colors.border, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary },
  cardArea: { flex: 1, minHeight: 360 }, pressable: { flex: 1 }, flashcard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 15, padding: 26, borderRadius: 26, backgroundColor: colors.surface, ...shadows.card }, face: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden' }, back: { backgroundColor: colors.primarySoft }, faceLabel: { position: 'absolute', top: 24, color: colors.primary, fontWeight: '900', letterSpacing: 1.4, fontSize: 12 }, term: { color: colors.text, fontSize: 36, fontWeight: '900', textAlign: 'center' }, pronunciation: { color: colors.primary, fontSize: 17 }, meaning: { color: colors.text, fontSize: 27, fontWeight: '900', textAlign: 'center' }, example: { color: colors.muted, fontSize: 16, lineHeight: 24, fontStyle: 'italic', textAlign: 'center' }, tapHint: { position: 'absolute', bottom: 25 }, hint: { color: colors.muted, textAlign: 'center' }, image: { width: 120, height: 90, borderRadius: 14 },
  frontSpeakerButton: { width: 58, height: 58, marginTop: 5, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primarySoft, zIndex: 3, ...shadows.card },
  ratingRow: { flexDirection: 'row', gap: 8 }, rating: { flex: 1, gap: 5 }, interval: { color: colors.muted, textAlign: 'center', fontSize: 11 }, swipeHint: { color: colors.muted, fontSize: 12, textAlign: 'center' }, error: { color: colors.danger, textAlign: 'center' },
});
