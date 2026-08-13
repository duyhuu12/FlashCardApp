import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { getDeck, listCards, listProgress, saveReview } from '@/src/services/deckService';
import { speakEnglish, stopSpeaking } from '@/src/services/speechService';
import { colors, shadows } from '@/src/theme/colors';
import type { CardProgress, Flashcard } from '@/src/types/models';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type PracticeMode = 'quiz' | 'match' | 'write';

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function PracticeScreen() {
  const { deckId, mode = 'quiz' } = useLocalSearchParams<{ deckId: string; mode?: PracticeMode }>();
  const { user } = useAuth(); const router = useRouter();
  const [cards, setCards] = useState<Flashcard[]>([]); const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [index, setIndex] = useState(0); const [score, setScore] = useState(0); const [answer, setAnswer] = useState(''); const [feedback, setFeedback] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(''); const [matched, setMatched] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [title, setTitle] = useState('');
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!user) return; setLoading(true); setError('');
    try {
      const [deck, allCards, allProgress] = await Promise.all([getDeck(deckId), listCards(deckId), listProgress(user.uid, deckId)]);
      setTitle(deck?.title ?? 'Luyện tập'); setCards(shuffled(allCards).slice(0, mode === 'match' ? 8 : 12));
      setProgress(Object.fromEntries(allProgress.map((item) => [item.cardId, item])));
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, [deckId, mode, user]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, []);

  const current = cards[index];
  useEffect(() => {
    if (mode !== 'quiz' || !current) return;
    speakEnglish(current.term).catch(() => undefined);
    return () => { stopSpeaking().catch(() => undefined); };
  }, [current, mode]);
  const options = useMemo(() => current ? shuffled([current, ...shuffled(cards.filter((card) => card.id !== current.id)).slice(0, 3)]) : [], [cards, current]);
  const matchCards = cards.slice(0, 4);
  const matchMeanings = useMemo(() => shuffled(cards.slice(0, 4)), [cards]);
  const finished = mode === 'match' ? matchCards.length > 0 && matched.length === matchCards.length : cards.length > 0 && index >= cards.length;

  async function record(card: Flashcard, correct: boolean) {
    if (!user) return;
    const next = await saveReview(user.uid, deckId, card.id, correct ? 'easy' : 'again', progress[card.id]);
    setProgress((value) => ({ ...value, [card.id]: next }));
  }

  async function choose(card: Flashcard) {
    if (!current || saving || feedback) return; setSaving(true);
    const correct = card.id === current.id; setFeedback(correct ? 'Chính xác!' : `Đáp án: ${current.meaning}`); if (correct) setScore((value) => value + 1);
    try { await record(current, correct); } catch (e) { setError(friendlyError(e)); } finally { setSaving(false); }
  }

  async function submitWrite() {
    if (!current || !answer.trim() || saving || feedback) return;
    setError('');
    const normalize = (value: string) => value.trim().toLocaleLowerCase('vi-VN');
    const correct = normalize(answer) === normalize(current.term); setFeedback(correct ? 'Chính xác!' : `Đáp án: ${current.term}`); if (correct) setScore((value) => value + 1);
    setSaving(true);
    try {
      await record(current, correct);
      if (correct) {
        autoAdvanceTimer.current = setTimeout(next, 650);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = null;
    setIndex((value) => value + 1); setAnswer(''); setFeedback(''); setError('');
  }

  async function chooseMeaning(card: Flashcard) {
    if (!selectedTerm || saving || matched.includes(card.id)) return;
    if (selectedTerm !== card.id) { setFeedback('Chưa đúng, hãy thử lại.'); return; }
    setFeedback(''); setMatched((items) => [...items, card.id]); setScore((value) => value + 1); setSelectedTerm(''); setSaving(true);
    try { await record(card, true); } catch (e) { setError(friendlyError(e)); } finally { setSaving(false); }
  }

  if (loading) return <AppScreen><LoadingView message="Đang tạo bài luyện tập..." /></AppScreen>;
  if (error && cards.length === 0) return <AppScreen><ErrorView message={error} onRetry={load} /></AppScreen>;
  if (finished) return <AppScreen contentStyle={styles.result}><View style={styles.resultIcon}><Ionicons name="trophy" size={48} color={colors.warning} /></View><Text style={styles.resultTitle}>Hoàn thành!</Text><Text style={styles.resultScore}>{score}/{mode === 'match' ? matchCards.length : cards.length} câu đúng</Text><AppButton title="Về lộ trình" onPress={() => router.replace('/(tabs)')} /><AppButton title="Luyện lại" variant="secondary" onPress={() => { setIndex(0); setScore(0); setMatched([]); setFeedback(''); setAnswer(''); setCards(shuffled(cards)); }} /></AppScreen>;

  return <AppScreen contentStyle={styles.screen}>
    <View style={styles.header}><View><Text style={styles.mode}>{mode === 'quiz' ? 'TRẮC NGHIỆM' : mode === 'write' ? 'NHẬP TỪ' : 'GHÉP CẶP'}</Text><Text style={styles.title} numberOfLines={1}>{title}</Text></View><Text style={styles.score}>{score} điểm</Text></View>
    {mode !== 'match' ? <><View style={styles.track}><View style={[styles.fill, { width: `${(index / cards.length) * 100}%` }]} /></View><View style={styles.question}><Text style={styles.questionHint}>{mode === 'write' ? 'Nhập từ tiếng Anh tương ứng' : 'Chọn nghĩa đúng'}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Phát âm ${current?.term ?? ''}`} onPress={() => current && speakEnglish(current.term).catch(() => undefined)} style={styles.speakerButton}><Ionicons name="volume-high" size={25} color={colors.primary} /></Pressable><Text style={styles.questionText}>{mode === 'write' ? current?.meaning : current?.term}</Text>{current?.pronunciation && mode === 'quiz' ? <Text style={styles.pronunciation}>/{current.pronunciation}/</Text> : null}</View>
      {mode === 'quiz' ? <View style={styles.options}>{options.map((option) => <Pressable key={option.id} disabled={Boolean(feedback)} onPress={() => choose(option)} style={styles.option}><Text style={styles.optionText}>{option.meaning}</Text></Pressable>)}</View> : <View style={styles.writeBox}><TextInput value={answer} onChangeText={setAnswer} onSubmitEditing={submitWrite} autoCapitalize="none" blurOnSubmit={false} placeholder="Nhập từ tiếng Anh..." placeholderTextColor={colors.muted} style={styles.input} /><AppButton title="Kiểm tra" onPress={submitWrite} disabled={!answer.trim() || saving || Boolean(feedback)} /></View>}
      {feedback ? <View style={[styles.feedback, feedback === 'Chính xác!' ? styles.feedbackGood : styles.feedbackBad]}><Text style={styles.feedbackText}>{feedback}</Text>{mode === 'write' && feedback === 'Chính xác!' && !error ? <Text style={styles.autoAdvanceText}>Đang chuyển sang từ tiếp theo...</Text> : <AppButton title="Tiếp tục" onPress={next} />}</View> : null}</> : <>
      <Text style={styles.matchHint}>Chọn một từ, sau đó chọn nghĩa tương ứng.</Text><View style={styles.matchColumns}><View style={styles.matchColumn}>{matchCards.map((card) => <Pressable key={card.id} disabled={matched.includes(card.id)} onPress={() => { setSelectedTerm(card.id); setFeedback(''); speakEnglish(card.term).catch(() => undefined); }} style={[styles.matchItem, selectedTerm === card.id && styles.matchSelected, matched.includes(card.id) && styles.matchDone]}><View style={styles.matchTermRow}><Ionicons name="volume-medium" size={17} color={colors.primary} /><Text style={styles.matchText}>{card.term}</Text></View></Pressable>)}</View><View style={styles.matchColumn}>{matchMeanings.map((card) => <Pressable key={card.id} disabled={matched.includes(card.id)} onPress={() => chooseMeaning(card)} style={[styles.matchItem, matched.includes(card.id) && styles.matchDone]}><Text style={styles.matchText}>{card.meaning}</Text></Pressable>)}</View></View>{feedback ? <Text style={styles.inlineError}>{feedback}</Text> : null}</>}
    {error ? <Text style={styles.inlineError}>{error}</Text> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({ screen: { width: '100%', maxWidth: 620, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mode: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { maxWidth: 260, color: colors.text, fontSize: 20, fontWeight: '900' }, score: { color: colors.warning, fontWeight: '900' }, track: { height: 7, borderRadius: 8, backgroundColor: colors.border, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary }, question: { minHeight: 190, padding: 24, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface, ...shadows.card }, questionHint: { color: colors.muted }, speakerButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, questionText: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }, pronunciation: { color: colors.primary }, options: { gap: 10 }, option: { minHeight: 55, padding: 14, borderRadius: 15, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, optionText: { color: colors.text, fontWeight: '700' }, writeBox: { gap: 12 }, input: { minHeight: 58, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderColor: colors.primarySoft, backgroundColor: colors.surface, color: colors.text, fontSize: 18 }, feedback: { gap: 10, padding: 15, borderRadius: 16 }, feedbackGood: { backgroundColor: colors.successSoft }, feedbackBad: { backgroundColor: colors.dangerSoft }, feedbackText: { color: colors.text, fontWeight: '900', textAlign: 'center' }, autoAdvanceText: { color: colors.success, fontSize: 12, fontWeight: '700', textAlign: 'center' }, matchHint: { color: colors.muted, textAlign: 'center' }, matchColumns: { flexDirection: 'row', gap: 10 }, matchColumn: { flex: 1, gap: 10 }, matchItem: { minHeight: 65, padding: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border }, matchSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, matchDone: { opacity: 0.28, backgroundColor: colors.successSoft }, matchTermRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, matchText: { color: colors.text, fontWeight: '800', textAlign: 'center' }, inlineError: { color: colors.danger, textAlign: 'center', fontWeight: '700' }, result: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center' }, resultIcon: { alignSelf: 'center', width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft }, resultTitle: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }, resultScore: { color: colors.primary, fontSize: 20, fontWeight: '900', textAlign: 'center' } });
