import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { EmptyView, ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import {
  cloneDeck,
  getDeck,
  getDeckFromCache,
  listCardsPage,
  listFirstCardsPageFromCache,
  removeCard,
  removeDeck,
  type CardPageCursor,
} from '@/src/services/deckService';
import { speakEnglish, stopSpeaking } from '@/src/services/speechService';
import { resolveDeckColor, useAppTheme, useThemedStyles, type AppColors, type AppShadows } from '@/src/theme/colors';
import type { Deck, Flashcard } from '@/src/types/models';
import { getAvatarSource } from '@/src/constants/avatarOptions';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function DeckDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [cursor, setCursor] = useState<CardPageCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    if (!hasLoaded.current) setLoading(true);
    setError('');
    let hasVisibleData = hasLoaded.current;
    try {
      const [cachedDeck, cachedCards] = await Promise.all([
        getDeckFromCache(id),
        listFirstCardsPageFromCache(id),
      ]);
      if (cachedDeck) {
        setDeck(cachedDeck);
        setCards(cachedCards);
        setLoading(false);
        hasVisibleData = true;
      }
      const [nextDeck, page] = await Promise.all([getDeck(id), listCardsPage(id)]);
      if (!nextDeck) throw new Error('Bộ từ không tồn tại.');
      setDeck(nextDeck);
      setCards(page.cards);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      hasLoaded.current = true;
    } catch (e) {
      if (!hasVisibleData) setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => () => { stopSpeaking().catch(() => undefined); }, []));

  const loadMore = useCallback(async () => {
    if (!id || !cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listCardsPage(id, cursor);
      setCards((current) => {
        const existing = new Set(current.map((card) => card.id));
        return [...current, ...page.cards.filter((card) => !existing.has(card.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      Alert.alert('Không thể tải thêm', friendlyError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, id, loadingMore]);

  function confirmDeleteDeck() {
    if (!user || !deck) return;
    Alert.alert('Xóa bộ từ?', `Toàn bộ ${deck.cardCount} thẻ và tiến độ liên quan sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            await removeDeck(user.uid, deck.id);
            router.replace('/(tabs)');
          } catch (e) {
            Alert.alert('Không thể xóa', friendlyError(e));
          }
        },
      },
    ]);
  }

  async function copyToLibrary() {
    if (!user || !deck || copying) return;
    setCopying(true);
    try {
      const copiedDeckId = await cloneDeck(user.uid, deck);
      Alert.alert(
        'Đã sao chép bộ từ',
        'Bộ từ đã được thêm vào thư viện của bạn.',
        [
          { text: 'Ở lại', style: 'cancel' },
          { text: 'Xem bản sao', onPress: () => router.replace('/deck/' + copiedDeckId) },
        ],
      );
    } catch (e) {
      Alert.alert('Không thể sao chép', friendlyError(e));
    } finally {
      setCopying(false);
    }
  }

  function confirmDeleteCard(card: Flashcard) {
    if (!user) return;
    Alert.alert('Xóa thẻ?', `Bạn có chắc muốn xóa “${card.term}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            await removeCard(user.uid, id, card.id);
            await load();
          } catch (e) {
            Alert.alert('Không thể xóa', friendlyError(e));
          }
        },
      },
    ]);
  }

  if (loading) return <AppScreen><LoadingView /></AppScreen>;
  if (error || !deck) return <AppScreen><ErrorView message={error || 'Không tìm thấy bộ từ.'} onRetry={load} /></AppScreen>;

  const owner = deck.ownerId === user?.uid;
  const editable = owner && !deck.pathId;
  return (
    <AppScreen>
      <View style={[styles.banner, { backgroundColor: resolveDeckColor(deck.color, colors.primary) }]}>
        <View style={styles.bannerTop}>
          {deck.authorName ? (
            <View style={styles.authorAvatarCircle}>
              <Image source={getAvatarSource(deck.authorAvatarId)} style={styles.authorAvatarImg} />
            </View>
          ) : (
            <Ionicons name="book" size={32} color="#fff" />
          )}
          <View style={styles.actions}>
            {editable ? <Pressable onPress={() => router.push({ pathname: '/deck/form', params: { id } })}><Ionicons name="create-outline" size={25} color="#fff" /></Pressable> : null}
            {editable ? <Pressable onPress={confirmDeleteDeck}><Ionicons name="trash-outline" size={24} color="#fff" /></Pressable> : null}
          </View>
        </View>
        <Text style={styles.bannerTitle}>{deck.title}</Text>
        {deck.authorName ? (
          <View style={styles.authorRow}>
            <Image source={getAvatarSource(deck.authorAvatarId)} style={styles.authorSmallAvatar} />
            <Text style={styles.authorText}>Tác giả: {deck.authorName}</Text>
          </View>
        ) : null}
        <Text style={styles.bannerDescription}>{deck.description || 'Bộ từ vựng của bạn'}</Text>
        <Text style={styles.bannerMeta}>{deck.cardCount} thẻ · {deck.sourceLanguage} → {deck.targetLanguage}</Text>
      </View>
      <View style={styles.buttons}>
        <AppButton title="Ôn tập ngay" onPress={() => router.push(`/review/${id}`)} disabled={deck.cardCount === 0} style={{ flex: 1 }} />
        {editable ? <AppButton title="+ Thêm thẻ" variant="secondary" onPress={() => router.push({ pathname: '/card/form', params: { deckId: id } })} style={{ flex: 1 }} /> : null}
        {!owner && deck.isPublic ? <AppButton title="Sao chép vào thư viện" variant="secondary" onPress={copyToLibrary} loading={copying} style={{ flex: 1 }} /> : null}
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Danh sách thẻ</Text>
        <Text style={styles.count}>{cards.length}/{deck.cardCount} từ</Text>
      </View>
      {cards.length === 0 ? (
        <EmptyView
          title="Bộ từ đang trống"
          message={editable ? 'Thêm thẻ đầu tiên để bắt đầu ôn tập.' : 'Bài học này chưa có dữ liệu.'}
          actionTitle={editable ? 'Thêm thẻ' : undefined}
          onAction={editable ? () => router.push({ pathname: '/card/form', params: { deckId: id } }) : undefined}
        />
      ) : (
        <View style={styles.list}>
          {cards.map((card) => (
            <View key={card.id} style={styles.card}>
              <Pressable
                accessibilityHint="Mở chi tiết từ"
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/word/[deckId]/[cardId]', params: { deckId: id, cardId: card.id } })}
                style={({ pressed }) => [styles.cardContent, pressed && styles.cardContentPressed]}>
                <Text style={styles.term}>{card.term}</Text>
                {card.pronunciation ? <Text style={styles.pronunciation}>/{card.pronunciation}/</Text> : null}
                <Text style={styles.meaning}>{card.meaning}</Text>
                {card.example ? <Text style={styles.example}>{card.example}</Text> : null}
              </Pressable>
              <View style={styles.cardActions}><Pressable accessibilityRole="button" accessibilityLabel={`Phát âm ${card.term}`} onPress={() => speakEnglish(card.term).catch(() => undefined)} style={styles.cardSpeaker}><Ionicons name="volume-high" size={21} color={colors.primary} /></Pressable>{editable ? <><Pressable onPress={() => router.push({ pathname: '/card/form', params: { deckId: id, cardId: card.id } })}><Ionicons name="pencil" size={20} color={colors.primary} /></Pressable><Pressable onPress={() => confirmDeleteCard(card)}><Ionicons name="trash" size={20} color={colors.danger} /></Pressable></> : null}</View>
            </View>
          ))}
          {hasMore ? <AppButton title="Tải thêm 40 từ" variant="ghost" onPress={loadMore} loading={loadingMore} /> : null}
        </View>
      )}
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) => StyleSheet.create({
  banner: { borderRadius: 24, padding: 20, gap: 8, ...shadows.card },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authorAvatarCircle: { width: 46, height: 46, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.22)' },
  authorAvatarImg: { width: '100%', height: '100%' },
  authorSmallAvatar: { width: 18, height: 18, borderRadius: 9 },
  actions: { flexDirection: 'row', gap: 18 },
  bannerTitle: { color: '#fff', fontSize: 25, fontWeight: '900' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bannerDescription: { color: '#DDF9FA', lineHeight: 20 },
  bannerMeta: { color: '#fff', fontWeight: '700', marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  count: { color: colors.muted },
  list: { gap: 11 },
  card: { flexDirection: 'row', padding: 16, borderRadius: 17, backgroundColor: colors.surface, ...shadows.card },
  cardContent: { flex: 1 },
  cardContentPressed: { opacity: 0.6 },
  term: { color: colors.text, fontSize: 18, fontWeight: '900' },
  pronunciation: { color: colors.primary, marginTop: 3 },
  meaning: { color: colors.text, marginTop: 7 },
  example: { color: colors.muted, fontStyle: 'italic', marginTop: 7, lineHeight: 19 },
  cardActions: { justifyContent: 'space-around', paddingLeft: 14 },
  cardSpeaker: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
});
