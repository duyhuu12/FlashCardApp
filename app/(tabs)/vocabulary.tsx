import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { useAuth } from '@/src/context/AuthContext';
import {
  BUILT_IN_TOPIC_COUNT,
  BUILT_IN_WORD_COUNT,
  builtInDeckId,
  listBuiltInCategories,
  listBuiltInVocabulary,
  searchBuiltInVocabulary,
} from '@/src/services/builtInVocabularyService';
import { listOwnedDecks, listOwnedDecksFromCache, listProgress, listProgressFromCache } from '@/src/services/deckService';
import { speakEnglish, stopSpeaking } from '@/src/services/speechService';
import { colors, resolveDeckColor, shadows } from '@/src/theme/colors';
import type { CardProgress, Deck } from '@/src/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const SEARCH_RESULT_LIMIT = 50;
type LearningFilter = 'all' | 'new' | 'learning' | 'mastered' | 'hard' | 'favorite';

const learningFilters: { id: LearningFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Tất cả', icon: 'albums-outline' },
  { id: 'new', label: 'Chưa học', icon: 'sparkles-outline' },
  { id: 'learning', label: 'Đang học', icon: 'time-outline' },
  { id: 'mastered', label: 'Đã thuộc', icon: 'checkmark-circle-outline' },
  { id: 'hard', label: 'Từ khó', icon: 'alert-circle-outline' },
  { id: 'favorite', label: 'Yêu thích', icon: 'heart-outline' },
];

export default function VocabularyScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [learningFilter, setLearningFilter] = useState<LearningFilter>('all');
  const [progressItems, setProgressItems] = useState<CardProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState('');
  const [personalDecks, setPersonalDecks] = useState<Deck[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalError, setPersonalError] = useState('');
  const progressLoadedRef = useRef(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => new Set(['category-01']),
  );
  const firstLessonId = user ? builtInDeckId(user.uid, 1) : '';
  const categories = useMemo(() => (user ? listBuiltInCategories(user.uid) : []), [user]);
  const allVocabulary = useMemo(() => (user ? listBuiltInVocabulary(user.uid) : []), [user]);
  const previewWords = allVocabulary.slice(0, 6);
  const normalizedQuery = deferredQuery.trim();
  const searchPending = query !== deferredQuery;
  const progressByCardId = useMemo(
    () => new Map(progressItems.map((progress) => [progress.cardId, progress])),
    [progressItems],
  );
  const statusCounts = useMemo(() => {
    let learning = 0; let mastered = 0; let hard = 0; let favorite = 0; let reviewed = 0;
    allVocabulary.forEach(({ card }) => {
      const progress = progressByCardId.get(card.id);
      if (progress?.favorite) favorite += 1;
      if (!progress?.lastReviewedAt) return;
      reviewed += 1;
      if (progress.mastered) mastered += 1;
      else learning += 1;
      if (progress.lastRating === 'hard' || progress.lastRating === 'again') hard += 1;
    });
    return { all: allVocabulary.length, new: allVocabulary.length - reviewed, learning, mastered, hard, favorite };
  }, [allVocabulary, progressByCardId]);
  const searchResults = useMemo(() => {
    const source = user && normalizedQuery
      ? searchBuiltInVocabulary(user.uid, normalizedQuery)
      : allVocabulary;
    if (learningFilter === 'all') return source;
    return source.filter(({ card }) => {
      const progress = progressByCardId.get(card.id);
      if (learningFilter === 'new') return !progress?.lastReviewedAt;
      if (learningFilter === 'mastered') return Boolean(progress?.lastReviewedAt && progress.mastered);
      if (learningFilter === 'learning') return Boolean(progress?.lastReviewedAt && !progress.mastered);
      if (learningFilter === 'favorite') return Boolean(progress?.favorite);
      return Boolean(progress?.lastReviewedAt && (progress.lastRating === 'hard' || progress.lastRating === 'again'));
    });
  }, [allVocabulary, learningFilter, normalizedQuery, progressByCardId, user]);
  const showFilteredResults = Boolean(normalizedQuery) || learningFilter !== 'all';
  const visibleResults = showFilteredResults ? searchResults.slice(0, SEARCH_RESULT_LIMIT) : [];
  const allCategoriesExpanded = categories.length > 0 && expandedCategoryIds.size === categories.length;

  const loadLearningProgress = useCallback(() => {
    let active = true;
    if (!user) {
      setProgressItems([]);
      setProgressLoading(false);
      return () => { active = false; };
    }
    if (!progressLoadedRef.current) setProgressLoading(true);
    setProgressError('');
    listProgressFromCache(user.uid).then((items) => {
      if (!active || items.length === 0) return;
      setProgressItems(items);
      setProgressLoading(false);
    });
    listProgress(user.uid)
      .then((items) => {
        if (!active) return;
        progressLoadedRef.current = true;
        setProgressItems(items);
      })
      .catch(() => { if (active) setProgressError('Không thể tải trạng thái học. Hãy kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (active) setProgressLoading(false); });
    return () => { active = false; };
  }, [user]);

  useFocusEffect(loadLearningProgress);

  const loadPersonalDecks = useCallback(() => {
    let active = true;
    if (!user) {
      setPersonalDecks([]);
      setPersonalLoading(false);
      return () => { active = false; };
    }
    setPersonalLoading(true);
    setPersonalError('');
    listOwnedDecksFromCache(user.uid)
      .then((items) => {
        if (active) setPersonalDecks(items.filter((deck) => !deck.pathId));
      })
      .catch(() => undefined)
      .finally(() => {
        listOwnedDecks(user.uid)
          .then((items) => { if (active) setPersonalDecks(items.filter((deck) => !deck.pathId)); })
          .catch(() => { if (active) setPersonalError('Không thể tải bộ từ cá nhân.'); })
          .finally(() => { if (active) setPersonalLoading(false); });
      });
    return () => { active = false; };
  }, [user]);

  useFocusEffect(loadPersonalDecks);
  useFocusEffect(useCallback(() => () => {
    stopSpeaking().catch(() => undefined);
  }, []));

  const toggleCategory = (categoryId: string) => {
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleAllCategories = () => {
    setExpandedCategoryIds(
      allCategoriesExpanded ? new Set() : new Set(categories.map((category) => category.id)),
    );
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Kho từ vựng</Text>
          <Text style={styles.subtitle}>Tra cứu nhanh trong toàn bộ lộ trình Anh–Việt.</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="book" size={27} color={colors.primary} />
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={22} color={colors.primary} />
        <TextInput
          accessibilityLabel="Tìm kiếm từ vựng Anh Việt"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Xóa nội dung tìm kiếm"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={22} color={colors.muted} />
          </Pressable>
        ) : null}
        {searchPending ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>Trạng thái học</Text>
          {progressLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        <ScrollView
          contentContainerStyle={styles.filterContent}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {learningFilters.map((filter) => {
            const selected = learningFilter === filter.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={progressLoading && filter.id !== 'all'}
                key={filter.id}
                onPress={() => setLearningFilter(filter.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                  pressed && styles.resultRowPressed,
                ]}>
                <Ionicons name={filter.icon} size={17} color={selected ? '#fff' : colors.primary} />
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                  {filter.label} · {statusCounts[filter.id].toLocaleString('vi-VN')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {progressError ? (
          <View style={styles.filterError}>
            <Text style={styles.filterErrorText}>{progressError}</Text>
            <Pressable accessibilityRole="button" onPress={() => loadLearningProgress()}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {showFilteredResults ? (
        <View style={styles.resultsCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {normalizedQuery ? 'Kết quả tìm kiếm' : learningFilters.find((item) => item.id === learningFilter)?.label}
            </Text>
            <Text style={styles.previewCount}>{searchResults.length} từ</Text>
          </View>

          {visibleResults.length ? visibleResults.map(({ card, deck, categoryTitle, topicTitle }) => (
            <Pressable
              accessibilityHint="Mở chi tiết từ"
              accessibilityRole="button"
              key={card.id}
              onPress={() => router.push({ pathname: '/word/[deckId]/[cardId]', params: { deckId: deck.id, cardId: card.id } })}
              style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}>
              <View style={styles.resultContent}>
                <View style={styles.resultTopLine}>
                  <Text numberOfLines={1} style={styles.resultTerm}>{card.term}</Text>
                  {card.pronunciation ? (
                    <Text numberOfLines={1} style={styles.pronunciation}>/{card.pronunciation}/</Text>
                  ) : null}
                </View>
                <Text style={styles.resultMeaning}>{card.meaning}</Text>
                <Text numberOfLines={1} style={styles.resultTopic}>
                  Bài {deck.topicOrder} · {categoryTitle} · {topicTitle}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Phát âm ${card.term}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  speakEnglish(card.term).catch(() => undefined);
                }}
                style={({ pressed }) => [styles.speakerButton, pressed && styles.speakerButtonPressed]}>
                <Ionicons name="volume-high" size={21} color={colors.primary} />
              </Pressable>
              {progressByCardId.get(card.id)?.favorite ? (
                <Ionicons name="heart" size={19} color={colors.danger} />
              ) : null}
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Pressable>
          )) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={30} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Không tìm thấy từ phù hợp</Text>
              <Text style={styles.emptyText}>
                {normalizedQuery
                  ? 'Thử nhập từ tiếng Anh, nghĩa tiếng Việt hoặc bỏ bớt ký tự.'
                  : 'Bạn chưa có từ nào thuộc trạng thái này.'}
              </Text>
            </View>
          )}

          {searchResults.length > SEARCH_RESULT_LIMIT ? (
            <Text style={styles.limitHint}>
              Đang hiển thị {SEARCH_RESULT_LIMIT} kết quả đầu tiên. Hãy nhập thêm ký tự để thu hẹp tìm kiếm.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.heroBadgeText}>LỘ TRÌNH CÓ SẴN</Text>
            </View>
            <Text style={styles.heroTitle}>3.000 từ tiếng Anh theo chủ đề</Text>
            <Text style={styles.heroDescription}>
              Gồm {BUILT_IN_WORD_COUNT.toLocaleString('vi-VN')} từ trong {BUILT_IN_TOPIC_COUNT} bài học. Mọi tài khoản đều có thể học ngay, không cần tải hoặc nhập dữ liệu.
            </Text>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}><Ionicons name="albums" size={18} color="#fff" /><Text style={styles.infoText}>{BUILT_IN_WORD_COUNT.toLocaleString('vi-VN')} từ</Text></View>
              <View style={styles.infoItem}><Ionicons name="map" size={18} color="#fff" /><Text style={styles.infoText}>{BUILT_IN_TOPIC_COUNT} bài</Text></View>
              <View style={styles.infoItem}><Ionicons name="language" size={18} color="#fff" /><Text style={styles.infoText}>Anh → Việt</Text></View>
            </View>
            <View style={styles.actions}>
              <AppButton title="Bắt đầu học" disabled={!firstLessonId} onPress={() => router.push({ pathname: '/review/[deckId]', params: { deckId: firstLessonId, mode: 'daily' } })} style={styles.actionButton} />
              <AppButton title="Xem 61 bài" variant="secondary" onPress={() => setExpandedCategoryIds(new Set(categories.map((category) => category.id)))} style={styles.actionButton} />
            </View>
          </View>

          <View style={styles.catalogSection}>
            <View style={styles.catalogHeading}>
              <View style={styles.catalogHeadingCopy}>
                <Text style={styles.catalogTitle}>10 nhóm từ vựng</Text>
                <Text style={styles.catalogSubtitle}>61 chủ đề được sắp xếp theo lộ trình</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={toggleAllCategories}
                style={styles.expandAllButton}>
                <Text style={styles.expandAllText}>{allCategoriesExpanded ? 'Thu gọn' : 'Mở tất cả'}</Text>
              </Pressable>
            </View>

            {categories.map((category) => {
              const expanded = expandedCategoryIds.has(category.id);
              return (
                <View key={category.id} style={styles.categoryCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => toggleCategory(category.id)}
                    style={({ pressed }) => [styles.categoryHeader, pressed && styles.resultRowPressed]}>
                    <View style={styles.categoryNumber}>
                      <Text style={styles.categoryNumberText}>{category.order}</Text>
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      <Text style={styles.categoryMeta}>
                        {category.topics.length} chủ đề · {category.wordCount.toLocaleString('vi-VN')} từ
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={21}
                      color={colors.primary}
                    />
                  </Pressable>

                  {expanded ? (
                    <View style={styles.topicList}>
                      {category.topics.map((topic, index) => (
                        <Pressable
                          accessibilityHint="Mở danh sách từ của chủ đề"
                          accessibilityRole="button"
                          key={topic.id}
                          onPress={() => router.push({ pathname: '/deck/[id]', params: { id: topic.id } })}
                          style={({ pressed }) => [
                            styles.topicRow,
                            index === category.topics.length - 1 && styles.topicRowLast,
                            pressed && styles.resultRowPressed,
                          ]}>
                          <View style={styles.topicNumber}>
                            <Text style={styles.topicNumberText}>{topic.topicOrder}</Text>
                          </View>
                          <View style={styles.topicCopy}>
                            <Text style={styles.topicTitle}>{topic.title}</Text>
                            <Text style={styles.topicMeta}>{topic.cardCount} từ</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.previewCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Xem trước · Chủ đề Động vật</Text>
              <Text style={styles.previewCount}>6/{BUILT_IN_WORD_COUNT}</Text>
            </View>
            {previewWords.map(({ card, deck }, index) => (
              <Pressable
                accessibilityHint="Mở chi tiết từ"
                accessibilityRole="button"
                key={card.id}
                onPress={() => router.push({ pathname: '/word/[deckId]/[cardId]', params: { deckId: deck.id, cardId: card.id } })}
                style={({ pressed }) => [styles.wordRow, index === previewWords.length - 1 && styles.wordRowLast, pressed && styles.resultRowPressed]}>
                <View style={styles.wordNumber}><Text style={styles.wordNumberText}>{index + 1}</Text></View>
                <Text style={styles.wordTerm}>{card.term}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.border} />
                <Text style={styles.wordMeaning} numberOfLines={2}>{card.meaning}</Text>
                <Pressable
                  accessibilityLabel={`Phát âm ${card.term}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation();
                    speakEnglish(card.term).catch(() => undefined);
                  }}
                  style={({ pressed }) => [styles.previewSpeakerButton, pressed && styles.speakerButtonPressed]}>
                  <Ionicons name="volume-high" size={19} color={colors.primary} />
                </Pressable>
              </Pressable>
            ))}
          </View>

          <View style={styles.personalSection}>
            <View style={styles.personalHeading}>
              <View style={styles.personalHeadingCopy}>
                <Text style={styles.catalogTitle}>Bộ từ cá nhân</Text>
                <Text style={styles.catalogSubtitle}>Tự tạo và quản lý những từ bạn muốn học</Text>
              </View>
              <Pressable
                accessibilityLabel="Tạo bộ từ mới"
                accessibilityRole="button"
                onPress={() => router.push('/deck/form')}
                style={styles.addPersonalButton}>
                <Ionicons name="add" size={25} color="#fff" />
              </Pressable>
            </View>

            {personalLoading && personalDecks.length === 0 ? (
              <View style={styles.personalState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.personalStateText}>Đang tải bộ từ của bạn...</Text>
              </View>
            ) : personalError && personalDecks.length === 0 ? (
              <View style={styles.personalState}>
                <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
                <Text style={styles.personalStateText}>{personalError}</Text>
                <Pressable accessibilityRole="button" onPress={() => loadPersonalDecks()}>
                  <Text style={styles.retryText}>Thử lại</Text>
                </Pressable>
              </View>
            ) : personalDecks.length === 0 ? (
              <View style={styles.customCard}>
                <View style={styles.customIcon}><Ionicons name="create" size={25} color={colors.warning} /></View>
                <View style={styles.customCopy}>
                  <Text style={styles.customTitle}>Bạn chưa có bộ từ riêng</Text>
                  <Text style={styles.customText}>Tạo bộ đầu tiên và thêm những từ bạn muốn ghi nhớ.</Text>
                </View>
                <AppButton title="Tạo bộ" variant="ghost" onPress={() => router.push('/deck/form')} style={styles.createButton} />
              </View>
            ) : (
              <View style={styles.personalList}>
                {personalDecks.map((deck) => (
                  <Pressable
                    accessibilityHint="Mở bộ từ cá nhân"
                    accessibilityRole="button"
                    key={deck.id}
                    onPress={() => router.push({ pathname: '/deck/[id]', params: { id: deck.id } })}
                    style={({ pressed }) => [styles.personalDeckCard, pressed && styles.resultRowPressed]}>
                    <View style={[styles.personalDeckIcon, { backgroundColor: resolveDeckColor(deck.color) }]}>
                      <Ionicons name="layers" size={23} color="#fff" />
                    </View>
                    <View style={styles.personalDeckCopy}>
                      <Text numberOfLines={1} style={styles.personalDeckTitle}>{deck.title}</Text>
                      <Text numberOfLines={1} style={styles.personalDeckMeta}>{deck.cardCount} thẻ · {deck.sourceLanguage} → {deck.targetLanguage}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.muted, marginTop: 5 },
  headerIcon: { width: 49, height: 49, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderWidth: 1.5, borderColor: colors.primarySoft, borderRadius: 18, backgroundColor: colors.surface, ...shadows.card },
  searchInput: { flex: 1, minHeight: 50, color: colors.text, fontSize: 15 },
  filterSection: { gap: 8 },
  filterHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: 14, backgroundColor: colors.surface },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterChipText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  filterChipTextSelected: { color: '#fff' },
  filterError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.dangerSoft },
  filterErrorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  retryText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  hero: { padding: 20, gap: 13, borderRadius: 24, backgroundColor: colors.primary, ...shadows.card },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroDescription: { color: '#D8F7F8', lineHeight: 21 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.13)' },
  infoText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  actionButton: { flex: 1 },
  catalogSection: { gap: 10 },
  catalogHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  catalogHeadingCopy: { flex: 1 },
  catalogTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  catalogSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  expandAllButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primarySoft },
  expandAllText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  categoryCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, ...shadows.card },
  categoryHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  categoryNumber: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  categoryNumberText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  categoryCopy: { flex: 1 },
  categoryTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  categoryMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  topicList: { paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F8FCFD' },
  topicRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  topicRowLast: { borderBottomWidth: 0 },
  topicNumber: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  topicNumberText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  topicCopy: { flex: 1, paddingVertical: 9 },
  topicTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  topicMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  previewCard: { padding: 17, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  resultsCard: { padding: 17, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 7 },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  previewCount: { color: colors.primary, fontWeight: '800' },
  resultRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultRowPressed: { opacity: 0.65 },
  resultContent: { flex: 1, gap: 3 },
  resultTopLine: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  resultTerm: { maxWidth: '62%', color: colors.text, fontSize: 17, fontWeight: '900' },
  pronunciation: { flex: 1, color: colors.muted, fontSize: 12 },
  resultMeaning: { color: colors.text, lineHeight: 19 },
  resultTopic: { color: colors.muted, fontSize: 11 },
  speakerButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  speakerButtonPressed: { opacity: 0.55 },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 34 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { maxWidth: 310, color: colors.muted, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  limitHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  wordRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  wordRowLast: { borderBottomWidth: 0 },
  wordNumber: { width: 27, height: 27, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  wordNumberText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  wordTerm: { width: 80, color: colors.text, fontWeight: '900' },
  wordMeaning: { flex: 1, color: colors.muted, lineHeight: 18 },
  previewSpeakerButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  personalSection: { gap: 11, marginTop: 2 },
  personalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  personalHeadingCopy: { flex: 1 },
  addPersonalButton: { width: 47, height: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...shadows.card },
  personalState: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 18, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  personalStateText: { color: colors.muted, lineHeight: 20, textAlign: 'center' },
  personalList: { gap: 9 },
  personalDeckCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, backgroundColor: colors.surface, ...shadows.card },
  personalDeckIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  personalDeckCopy: { flex: 1, gap: 4 },
  personalDeckTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  personalDeckMeta: { color: colors.muted, fontSize: 12 },
  customCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderRadius: 20, backgroundColor: colors.warningSoft },
  customIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  customCopy: { flex: 1 },
  customTitle: { color: colors.text, fontWeight: '900' },
  customText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  createButton: { minHeight: 42, paddingHorizontal: 12 },
});
