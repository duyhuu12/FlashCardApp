import { AppButton } from "@/src/components/AppButton";
import { AppScreen } from "@/src/components/AppScreen";
import { useAuth } from "@/src/context/AuthContext";
import type { BuiltInVocabularySearchResult } from "@/src/services/builtInVocabularyService";
import {
  BUILT_IN_WORD_COUNT,
  isBuiltInDeckId,
  listBuiltInCategories,
  searchBuiltInVocabulary,
} from "@/src/services/builtInVocabularyService";
import {
  listOwnedDecks,
  listOwnedDecksFromCache,
  listProgress,
  listProgressFromCache,
  setCardFavorite,
} from "@/src/services/deckService";
import { speakEnglish, stopSpeaking } from "@/src/services/speechService";
import {
  resolveDeckColor,
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { CardProgress, Deck } from "@/src/types/models";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SEARCH_RESULT_PAGE_SIZE = 40;
type VocabularySection = "vocabulary" | "practice";
type VocabularySort = "smart" | "az" | "recent" | "hard" | "due";
type LearningFilter =
  | "all"
  | "new"
  | "learning"
  | "mastered"
  | "due"
  | "hard"
  | "favorite";

const learningFilters: {
  id: LearningFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "all", label: "Tất cả", icon: "albums-outline" },
  { id: "new", label: "Chưa học", icon: "book-outline" },
  { id: "learning", label: "Đang học", icon: "sync-outline" },
  { id: "mastered", label: "Đã thuộc", icon: "ribbon-outline" },
  { id: "due", label: "Cần ôn", icon: "repeat-outline" },
  { id: "hard", label: "Từ khó", icon: "warning-outline" },
  { id: "favorite", label: "Yêu thích", icon: "heart-outline" },
];

const vocabularySorts: {
  id: VocabularySort;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "smart", label: "Phù hợp nhất", icon: "compass-outline" },
  { id: "az", label: "A–Z", icon: "text-outline" },
  { id: "recent", label: "Học gần đây", icon: "time-outline" },
  { id: "hard", label: "Khó nhất", icon: "warning-outline" },
  { id: "due", label: "Đến hạn trước", icon: "repeat-outline" },
];

const reviewModes: {
  id: "mistakes" | "hard" | "due" | "new";
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "mistakes",
    label: "Từ sai",
    description: "Ôn lại câu đã trả lời sai",
    icon: "close-circle",
  },
  {
    id: "hard",
    label: "Từ khó",
    description: "Tập trung vào từ khó nhớ",
    icon: "warning",
  },
  {
    id: "due",
    label: "Đến hạn",
    description: "Ôn theo lịch lặp lại",
    icon: "repeat",
  },
  {
    id: "new",
    label: "Từ mới",
    description: "Học những từ chưa gặp",
    icon: "book",
  },
];

const practiceModes: {
  id: "quiz" | "match" | "write";
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "quiz",
    label: "Trắc nghiệm",
    description: "Chọn đáp án đúng",
    icon: "help-circle",
  },
  {
    id: "match",
    label: "Ghép cặp",
    description: "Nối từ với nghĩa",
    icon: "git-compare",
  },
  {
    id: "write",
    label: "Nhập từ",
    description: "Gõ lại từ tiếng Anh",
    icon: "create",
  },
];

const learningFilterIds = new Set<LearningFilter>(
  learningFilters.map((filter) => filter.id),
);

function isProgressDue(progress?: CardProgress) {
  if (!progress?.lastReviewedAt || !progress.nextReviewAt) return false;
  const nextReviewTime =
    progress.nextReviewAt instanceof Date
      ? progress.nextReviewAt.getTime()
      : progress.nextReviewAt.toMillis();
  return nextReviewTime <= Date.now();
}

function progressDateMillis(value: CardProgress["nextReviewAt"] | undefined) {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

function createLocalProgress(
  cardId: string,
  deckId: string,
  favorite: boolean,
): CardProgress {
  const now = new Date();
  return {
    cardId,
    deckId,
    repetitions: 0,
    consecutiveCorrect: 0,
    intervalMinutes: 0,
    lastRating: null,
    lastReviewedAt: null,
    nextReviewAt: now,
    mastered: false,
    againCount: 0,
    hardCount: 0,
    easyCount: 0,
    favorite,
    updatedAt: now,
  };
}

export default function VocabularyScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filter: routeFilter } = useLocalSearchParams<{ filter?: string }>();
  const [section, setSection] = useState<VocabularySection>("vocabulary");
  const [learningFilter, setLearningFilter] = useState<LearningFilter>("all");
  const [sortMode, setSortMode] = useState<VocabularySort>("smart");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(SEARCH_RESULT_PAGE_SIZE);
  const [savingFavoriteIds, setSavingFavoriteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [progressItems, setProgressItems] = useState<CardProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [personalDecks, setPersonalDecks] = useState<Deck[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalError, setPersonalError] = useState("");
  const [tabsPinned, setTabsPinned] = useState(false);
  const progressLoadedRef = useRef(false);
  const personalLoadedRef = useRef(false);
  const tabsTopRef = useRef(Number.POSITIVE_INFINITY);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedPracticeDeckId, setSelectedPracticeDeckId] = useState<string | null>(null);
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);
  const categories = useMemo(
    () => (user ? listBuiltInCategories(user.uid) : []),
    [user],
  );
  const practiceDeck = useMemo(() => {
    const decks = categories.flatMap((category) => category.topics);
    if (selectedPracticeDeckId) {
      const found = decks.find((deck) => deck.id === selectedPracticeDeckId);
      if (found) return found;
    }
    const reviewedByDeck = new Map<string, number>();
    progressItems.forEach((progress) => {
      if (!progress.lastReviewedAt) return;
      reviewedByDeck.set(
        progress.deckId,
        (reviewedByDeck.get(progress.deckId) ?? 0) + 1,
      );
    });
    return (
      decks.find(
        (deck) => (reviewedByDeck.get(deck.id) ?? 0) < deck.cardCount,
      ) ??
      decks[0] ??
      null
    );
  }, [categories, progressItems, selectedPracticeDeckId]);
  const normalizedQuery = "";
  const progressByCardId = useMemo(
    () => new Map(progressItems.map((progress) => [progress.cardId, progress])),
    [progressItems],
  );
  const allVocabulary = useMemo(
    () => (user ? searchBuiltInVocabulary(user.uid, "") : []),
    [user],
  );
  const todayWords = useMemo(() => {
    const ranked = allVocabulary
      .map((item) => {
        const progress = progressByCardId.get(item.card.id);
        if (isProgressDue(progress)) {
          return {
            item,
            priority: 0,
            order: progressDateMillis(progress?.nextReviewAt),
            label: "Đến hạn",
          };
        }
        if (
          progress?.lastReviewedAt &&
          (progress.lastRating === "hard" || progress.lastRating === "again")
        ) {
          return {
            item,
            priority: 1,
            order: -progressDateMillis(progress.updatedAt),
            label: "Từ khó",
          };
        }
        if (!progress?.lastReviewedAt) {
          return {
            item,
            priority: 2,
            order: item.card.sourceOrder ?? Number.MAX_SAFE_INTEGER,
            label: "Từ mới",
          };
        }
        return null;
      })
      .filter(
        (
          entry,
        ): entry is {
          item: BuiltInVocabularySearchResult;
          priority: number;
          order: number;
          label: string;
        } => Boolean(entry),
      )
      .sort(
        (left, right) =>
          left.priority - right.priority || left.order - right.order,
      );
    return ranked.slice(0, 6);
  }, [allVocabulary, progressByCardId]);
  const statusCounts = useMemo(() => {
    let learning = 0;
    let mastered = 0;
    let hard = 0;
    let due = 0;
    let favorite = 0;
    let reviewed = 0;
    progressItems.forEach((progress) => {
      if (!isBuiltInDeckId(progress.deckId)) return;
      if (progress?.favorite) favorite += 1;
      if (!progress?.lastReviewedAt) return;
      reviewed += 1;
      if (progress.mastered) mastered += 1;
      else learning += 1;
      if (isProgressDue(progress)) due += 1;
      if (progress.lastRating === "hard" || progress.lastRating === "again")
        hard += 1;
    });
    return {
      all: BUILT_IN_WORD_COUNT,
      new: Math.max(0, BUILT_IN_WORD_COUNT - reviewed),
      learning,
      mastered,
      due,
      hard,
      favorite,
    };
  }, [progressItems]);
  const showFilteredResults = learningFilter !== "all";
  const searchResults = useMemo(() => {
    if (!user || !showFilteredResults) return [];
    const source = searchBuiltInVocabulary(user.uid, normalizedQuery);
    const filtered = source.filter(({ card }) => {
      const progress = progressByCardId.get(card.id);
      if (learningFilter === "new") return !progress?.lastReviewedAt;
      if (learningFilter === "mastered")
        return Boolean(progress?.lastReviewedAt && progress.mastered);
      if (learningFilter === "learning")
        return Boolean(progress?.lastReviewedAt && !progress.mastered);
      if (learningFilter === "due") return isProgressDue(progress);
      if (learningFilter === "favorite") return Boolean(progress?.favorite);
      return Boolean(
        progress?.lastReviewedAt &&
        (progress.lastRating === "hard" || progress.lastRating === "again"),
      );
    });
    if (sortMode === "az") {
      return [...filtered].sort((left, right) =>
        left.card.term.localeCompare(right.card.term, "en"),
      );
    }
    if (sortMode === "recent") {
      return [...filtered].sort(
        (left, right) =>
          progressDateMillis(progressByCardId.get(right.card.id)?.updatedAt) -
          progressDateMillis(progressByCardId.get(left.card.id)?.updatedAt),
      );
    }
    if (sortMode === "hard") {
      return [...filtered].sort((left, right) => {
        const leftProgress = progressByCardId.get(left.card.id);
        const rightProgress = progressByCardId.get(right.card.id);
        const leftHard =
          (leftProgress?.againCount ?? 0) + (leftProgress?.hardCount ?? 0);
        const rightHard =
          (rightProgress?.againCount ?? 0) + (rightProgress?.hardCount ?? 0);
        return rightHard - leftHard;
      });
    }
    if (sortMode === "due") {
      return [...filtered].sort((left, right) => {
        const leftTime = progressDateMillis(
          progressByCardId.get(left.card.id)?.nextReviewAt,
        );
        const rightTime = progressDateMillis(
          progressByCardId.get(right.card.id)?.nextReviewAt,
        );
        return (
          (leftTime || Number.MAX_SAFE_INTEGER) -
          (rightTime || Number.MAX_SAFE_INTEGER)
        );
      });
    }
    return filtered;
  }, [
    learningFilter,
    normalizedQuery,
    progressByCardId,
    showFilteredResults,
    sortMode,
    user,
  ]);
  const visibleResults = showFilteredResults
    ? searchResults.slice(0, visibleLimit)
    : [];
  const allCategoriesExpanded =
    categories.length > 0 && expandedCategoryIds.size === categories.length;
  const catalogSummary = useMemo(
    () =>
      categories.reduce(
        (total, category) => ({
          topics: total.topics + category.topics.length,
          words: total.words + category.wordCount,
        }),
        { topics: 0, words: 0 },
      ),
    [categories],
  );
  const practiceProgress = useMemo(() => {
    if (!practiceDeck) return { reviewed: 0, mastered: 0 };
    return progressItems.reduce(
      (total, progress) => {
        if (progress.deckId !== practiceDeck.id || !progress.lastReviewedAt)
          return total;
        total.reviewed += 1;
        if (progress.mastered) total.mastered += 1;
        return total;
      },
      { reviewed: 0, mastered: 0 },
    );
  }, [practiceDeck, progressItems]);

  const loadLearningProgress = useCallback(() => {
    let active = true;
    if (!user) {
      setProgressItems([]);
      setProgressLoading(false);
      return () => {
        active = false;
      };
    }
    if (!progressLoadedRef.current) setProgressLoading(true);
    setProgressError("");
    listProgressFromCache(user.uid).then((items) => {
      if (!active) return;
      setProgressItems(items);
      setProgressLoading(false);
    });
    listProgress(user.uid)
      .then((items) => {
        if (!active) return;
        progressLoadedRef.current = true;
        setProgressItems(items);
      })
      .catch(() => {
        if (active)
          setProgressError(
            "Không thể tải trạng thái học. Hãy kiểm tra kết nối và thử lại.",
          );
      })
      .finally(() => {
        if (active) setProgressLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useFocusEffect(loadLearningProgress);
  useFocusEffect(
    useCallback(() => {
      if (!routeFilter || !learningFilterIds.has(routeFilter as LearningFilter))
        return;
      setSection("vocabulary");
      setLearningFilter(routeFilter as LearningFilter);
    }, [routeFilter]),
  );

  const loadPersonalDecks = useCallback(() => {
    let active = true;
    if (!user) {
      setPersonalDecks([]);
      setPersonalLoading(false);
      return () => {
        active = false;
      };
    }
    if (!personalLoadedRef.current) setPersonalLoading(true);
    setPersonalError("");
    listOwnedDecksFromCache(user.uid)
      .then((items) => {
        if (!active) return;
        setPersonalDecks(items.filter((deck) => !deck.pathId));
        setPersonalLoading(false);
      })
      .catch(() => undefined);
    listOwnedDecks(user.uid)
      .then((items) => {
        if (!active) return;
        personalLoadedRef.current = true;
        setPersonalDecks(items.filter((deck) => !deck.pathId));
      })
      .catch(() => {
        if (active) setPersonalError("Không thể tải bộ từ cá nhân.");
      })
      .finally(() => {
        if (active) setPersonalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useFocusEffect(loadPersonalDecks);
  useEffect(() => {
    setVisibleLimit(SEARCH_RESULT_PAGE_SIZE);
    if (!showFilteredResults) setSortMenuOpen(false);
  }, [learningFilter, normalizedQuery, showFilteredResults, sortMode]);
  useFocusEffect(
    useCallback(
      () => () => {
        stopSpeaking().catch(() => undefined);
      },
      [],
    ),
  );

  const toggleFavorite = useCallback(
    async (item: BuiltInVocabularySearchResult) => {
      if (!user || savingFavoriteIds.has(item.card.id)) return;
      const previous = progressByCardId.get(item.card.id);
      const nextFavorite = !previous?.favorite;
      setSavingFavoriteIds((current) => {
        const next = new Set(current);
        next.add(item.card.id);
        return next;
      });
      setProgressItems((current) => {
        const index = current.findIndex(
          (progress) => progress.cardId === item.card.id,
        );
        if (index < 0) {
          return [
            ...current,
            createLocalProgress(item.card.id, item.deck.id, nextFavorite),
          ];
        }
        const next = [...current];
        next[index] = { ...next[index], favorite: nextFavorite };
        return next;
      });
      try {
        await setCardFavorite(
          user.uid,
          item.deck.id,
          item.card.id,
          nextFavorite,
        );
      } catch {
        setProgressItems((current) => {
          if (!previous) {
            return current.filter(
              (progress) => progress.cardId !== item.card.id,
            );
          }
          return current.map((progress) =>
            progress.cardId === item.card.id ? previous : progress,
          );
        });
        Alert.alert(
          "Không thể lưu yêu thích",
          "Hãy kiểm tra kết nối và thử lại.",
        );
      } finally {
        setSavingFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(item.card.id);
          return next;
        });
      }
    },
    [progressByCardId, savingFavoriteIds, user],
  );

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
      allCategoriesExpanded
        ? new Set()
        : new Set(categories.map((category) => category.id)),
    );
  };

  const renderLearningFilters = () => (
    <View style={styles.filterSection}>
      <View style={styles.filterHeader}>
        <Text style={styles.filterLabel}>Trạng thái học</Text>
        {progressLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={styles.filterContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {learningFilters.map((filter) => {
          const selected = learningFilter === filter.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={progressLoading && filter.id !== "all"}
              key={filter.id}
              onPress={() => setLearningFilter(filter.id)}
              style={({ pressed }) => [
                styles.filterChip,
                selected && styles.filterChipSelected,
                pressed && styles.resultRowPressed,
              ]}
            >
              <Ionicons
                name={filter.icon}
                size={17}
                color={selected ? "#fff" : colors.primary}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextSelected,
                ]}
              >
                {filter.label} ·{" "}
                {statusCounts[filter.id].toLocaleString("vi-VN")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {progressError ? (
        <View style={styles.filterError}>
          <Text style={styles.filterErrorText}>{progressError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => loadLearningProgress()}
          >
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderSectionTabs = (pinned = false) => (
    <View
      accessibilityRole="tablist"
      onLayout={
        pinned
          ? undefined
          : (event) => {
              tabsTopRef.current = event.nativeEvent.layout.y;
            }
      }
      style={[styles.segmentedControl, pinned && styles.segmentedControlPinned]}
    >
      {(
        [
          ["vocabulary", "book", "Từ vựng"],
          ["practice", "game-controller", "Luyện tập"],
        ] as const
      ).map(([id, icon, label]) => {
        const selected = section === id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={id}
            onPress={() => {
              setSection(id);
            }}
            style={({ pressed }) => [
              styles.segmentButton,
              selected && styles.segmentButtonSelected,
              pressed && styles.resultRowPressed,
            ]}
          >
            <Ionicons
              name={icon}
              size={20}
              color={selected ? colors.primary : colors.muted}
            />
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <AppScreen
      contentStyle={styles.screen}
      safeAreaEdges={["left", "right"]}
      scrollProps={{
        onScroll: (event) => {
          const nextPinned =
            event.nativeEvent.contentOffset.y >=
            tabsTopRef.current - insets.top;
          setTabsPinned((current) =>
            current === nextPinned ? current : nextPinned,
          );
        },
        scrollEventThrottle: 16,
      }}
      floatingContent={
        tabsPinned ? (
          <View style={[styles.pinnedTabsLayer, { paddingTop: insets.top }]}>
            {renderSectionTabs(true)}
          </View>
        ) : null
      }
    >
      <StatusBar
        style={tabsPinned ? (isDark ? "light" : "dark") : "light"}
        translucent
        backgroundColor="transparent"
      />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Kho từ vựng</Text>
          <Text style={styles.subtitle}>
            Tra cứu nhanh trong toàn bộ lộ trình Anh-Việt.
          </Text>
        </View>
        {section === "vocabulary" ? (
          <Pressable
            accessibilityLabel="Mở trang tìm kiếm"
            accessibilityRole="button"
            onPress={() => router.push("/vocabulary-search")}
            style={({ pressed }) => [
              styles.headerIcon,
              pressed && styles.resultRowPressed,
            ]}
          >
            <Ionicons name="search" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {renderSectionTabs()}

      {section === "vocabulary" ? (
        <>
          {renderLearningFilters()}

          {!showFilteredResults && todayWords.length ? (
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <View style={styles.todayHeadingCopy}>
                  <Text style={styles.todayEyebrow}>GỢI Ý HÔM NAY</Text>
                  <Text style={styles.todayTitle}>Từ hôm nay</Text>
                  <Text style={styles.todaySubtitle}>
                    Ưu tiên từ đến hạn, từ khó và từ mới.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!todayWords[0]}
                  onPress={() =>
                    todayWords[0] &&
                    router.push({
                      pathname: "/review/[deckId]",
                      params: {
                        deckId: todayWords[0].item.deck.id,
                        mode: "daily",
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.quickStudyButton,
                    pressed && styles.resultRowPressed,
                  ]}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.quickStudyText}>Học nhanh</Text>
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={styles.todayWords}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {todayWords.map(({ item, label }) => {
                  const favorite = Boolean(
                    progressByCardId.get(item.card.id)?.favorite,
                  );
                  return (
                    <Pressable
                      accessibilityHint="Mở chi tiết từ"
                      accessibilityRole="button"
                      key={item.card.id}
                      onPress={() =>
                        router.push({
                          pathname: "/word/[deckId]/[cardId]",
                          params: {
                            deckId: item.deck.id,
                            cardId: item.card.id,
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.todayWord,
                        pressed && styles.resultRowPressed,
                      ]}
                    >
                      <View style={styles.todayWordTop}>
                        <Text style={styles.todayWordStatus}>{label}</Text>
                        <Pressable
                          accessibilityLabel={
                            favorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"
                          }
                          accessibilityRole="button"
                          disabled={savingFavoriteIds.has(item.card.id)}
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleFavorite(item);
                          }}
                        >
                          {savingFavoriteIds.has(item.card.id) ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                          ) : (
                            <Ionicons
                              name={favorite ? "heart" : "heart-outline"}
                              size={19}
                              color={favorite ? colors.danger : colors.muted}
                            />
                          )}
                        </Pressable>
                      </View>
                      <Text numberOfLines={1} style={styles.todayWordTerm}>
                        {item.card.term}
                      </Text>
                      <Text numberOfLines={2} style={styles.todayWordMeaning}>
                        {item.card.meaning}
                      </Text>
                      <Pressable
                        accessibilityLabel={`Phát âm ${item.card.term}`}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          speakEnglish(item.card.term).catch(() => undefined);
                        }}
                        style={styles.todaySpeaker}
                      >
                        <Ionicons
                          name="volume-high"
                          size={18}
                          color={colors.primary}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {showFilteredResults ? (
            <View style={styles.resultsCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {normalizedQuery
                    ? "Kết quả tìm kiếm"
                    : learningFilters.find((item) => item.id === learningFilter)
                        ?.label}
                </Text>
                <Text style={styles.previewCount}>
                  {searchResults.length} từ
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: sortMenuOpen }}
                onPress={() => setSortMenuOpen((current) => !current)}
                style={styles.sortSelect}
              >
                <Ionicons
                  name="swap-vertical"
                  size={19}
                  color={colors.primary}
                />
                <Text style={styles.sortSelectText}>Sắp xếp</Text>
                <Text style={styles.sortValue}>
                  {vocabularySorts.find((item) => item.id === sortMode)?.label}
                </Text>
                <Ionicons
                  name={sortMenuOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
              {sortMenuOpen ? (
                <View style={styles.sortMenu}>
                  {vocabularySorts.map((option) => {
                    const selected = option.id === sortMode;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={option.id}
                        onPress={() => {
                          setSortMode(option.id);
                          setSortMenuOpen(false);
                        }}
                        style={[
                          styles.sortOption,
                          selected && styles.sortOptionSelected,
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={19}
                          color={colors.primary}
                        />
                        <Text style={styles.sortOptionText}>
                          {option.label}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark"
                            size={19}
                            color={colors.primary}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {visibleResults.length ? (
                visibleResults.map(
                  ({ card, deck, categoryTitle, topicTitle }) => (
                    <Pressable
                      accessibilityHint="Mở chi tiết từ"
                      accessibilityRole="button"
                      key={card.id}
                      onPress={() =>
                        router.push({
                          pathname: "/word/[deckId]/[cardId]",
                          params: { deckId: deck.id, cardId: card.id },
                        })
                      }
                      style={({ pressed }) => [
                        styles.resultRow,
                        pressed && styles.resultRowPressed,
                      ]}
                    >
                      <View style={styles.resultContent}>
                        <View style={styles.resultTopLine}>
                          <Text numberOfLines={1} style={styles.resultTerm}>
                            {card.term}
                          </Text>
                          {card.pronunciation ? (
                            <Text
                              numberOfLines={1}
                              style={styles.pronunciation}
                            >
                              /{card.pronunciation}/
                            </Text>
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
                        style={({ pressed }) => [
                          styles.speakerButton,
                          pressed && styles.speakerButtonPressed,
                        ]}
                      >
                        <Ionicons
                          name="volume-high"
                          size={21}
                          color={colors.primary}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={
                          progressByCardId.get(card.id)?.favorite
                            ? "Bỏ yêu thích"
                            : "Thêm vào yêu thích"
                        }
                        accessibilityRole="button"
                        disabled={savingFavoriteIds.has(card.id)}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleFavorite({
                            card,
                            deck,
                            categoryTitle,
                            topicTitle,
                          });
                        }}
                        style={({ pressed }) => [
                          styles.favoriteButton,
                          pressed && styles.speakerButtonPressed,
                        ]}
                      >
                        {savingFavoriteIds.has(card.id) ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Ionicons
                            name={
                              progressByCardId.get(card.id)?.favorite
                                ? "heart"
                                : "heart-outline"
                            }
                            size={20}
                            color={
                              progressByCardId.get(card.id)?.favorite
                                ? colors.danger
                                : colors.muted
                            }
                          />
                        )}
                      </Pressable>
                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={colors.muted}
                      />
                    </Pressable>
                  ),
                )
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="search-outline"
                      size={30}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    Không tìm thấy từ phù hợp
                  </Text>
                  <Text style={styles.emptyText}>
                    {normalizedQuery
                      ? "Thử nhập từ tiếng Anh, nghĩa tiếng Việt hoặc bỏ bớt ký tự."
                      : "Bạn chưa có từ nào thuộc trạng thái này."}
                  </Text>
                </View>
              )}

              {searchResults.length > visibleLimit ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setVisibleLimit((current) =>
                      Math.min(
                        current + SEARCH_RESULT_PAGE_SIZE,
                        searchResults.length,
                      ),
                    )
                  }
                  style={({ pressed }) => [
                    styles.loadMoreButton,
                    pressed && styles.resultRowPressed,
                  ]}
                >
                  <Text style={styles.loadMoreText}>
                    Xem thêm{" "}
                    {Math.min(
                      SEARCH_RESULT_PAGE_SIZE,
                      searchResults.length - visibleLimit,
                    )}{" "}
                    từ
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.catalogSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: catalogOpen }}
                  onPress={() => setCatalogOpen((current) => !current)}
                  style={({ pressed }) => [
                    styles.catalogOverview,
                    pressed && styles.resultRowPressed,
                  ]}
                >
                  <View style={styles.catalogOverviewIcon}>
                    <Ionicons name="library" size={25} color="#fff" />
                  </View>
                  <View style={styles.catalogHeadingCopy}>
                    <Text style={styles.catalogTitle}>Bộ từ vựng</Text>
                    <Text style={styles.catalogSubtitle}>
                      {categories.length} nhóm · {catalogSummary.topics} chủ đề
                      · {catalogSummary.words.toLocaleString("vi-VN")} từ
                    </Text>
                  </View>
                  <Ionicons
                    name={catalogOpen ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.primary}
                  />
                </Pressable>

                {catalogOpen ? (
                  <View style={styles.catalogContents}>
                    <View style={styles.catalogHeading}>
                      <View style={styles.catalogHeadingCopy}>
                        <Text style={styles.catalogListTitle}>
                          Danh sách nhóm
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={toggleAllCategories}
                        style={styles.expandAllButton}
                      >
                        <Text style={styles.expandAllText}>
                          {allCategoriesExpanded ? "Thu gọn" : "Mở tất cả"}
                        </Text>
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
                            style={({ pressed }) => [
                              styles.categoryHeader,
                              pressed && styles.resultRowPressed,
                            ]}
                          >
                            <View style={styles.categoryCopy}>
                              <Text style={styles.categoryTitle}>
                                {category.title}
                              </Text>
                              <Text style={styles.categoryMeta}>
                                {category.topics.length} chủ đề ·{" "}
                                {category.wordCount.toLocaleString("vi-VN")} từ
                              </Text>
                            </View>
                            <Ionicons
                              name={expanded ? "chevron-up" : "chevron-down"}
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
                                  onPress={() =>
                                    router.push({
                                      pathname: "/deck/[id]",
                                      params: { id: topic.id },
                                    })
                                  }
                                  style={({ pressed }) => [
                                    styles.topicRow,
                                    index === category.topics.length - 1 &&
                                      styles.topicRowLast,
                                    pressed && styles.resultRowPressed,
                                  ]}
                                >
                                  <View style={styles.topicCopy}>
                                    <Text style={styles.topicTitle}>
                                      {topic.title}
                                    </Text>
                                    <Text style={styles.topicMeta}>
                                      {topic.cardCount} từ
                                    </Text>
                                  </View>
                                  <Ionicons
                                    name="chevron-forward"
                                    size={19}
                                    color={colors.muted}
                                  />
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={styles.personalSection}>
                <View style={styles.personalHeading}>
                  <View style={styles.personalHeadingCopy}>
                    <Text style={styles.catalogTitle}>Bộ từ cá nhân</Text>
                    <Text style={styles.catalogSubtitle}>
                      Tự tạo và quản lý những từ bạn muốn học
                    </Text>
                  </View>
                  <Pressable accessibilityLabel="Tạo bộ từ mới"></Pressable>
                </View>

                {personalLoading && personalDecks.length === 0 ? (
                  <View style={styles.personalState}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.personalStateText}>
                      Đang tải bộ từ của bạn...
                    </Text>
                  </View>
                ) : personalError && personalDecks.length === 0 ? (
                  <View style={styles.personalState}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={30}
                      color={colors.danger}
                    />
                    <Text style={styles.personalStateText}>
                      {personalError}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => loadPersonalDecks()}
                    >
                      <Text style={styles.retryText}>Thử lại</Text>
                    </Pressable>
                  </View>
                ) : personalDecks.length === 0 ? (
                  <View style={styles.customCard}>
                    <View style={styles.customIcon}>
                      <Ionicons
                        name="create"
                        size={25}
                        color={colors.warning}
                      />
                    </View>
                    <View style={styles.customCopy}>
                      <Text style={styles.customTitle}>
                        Bạn chưa có bộ từ riêng
                      </Text>
                      <Text style={styles.customText}>
                        Tạo bộ đầu tiên và thêm những từ bạn muốn ghi nhớ.
                      </Text>
                    </View>
                    <AppButton
                      title="Tạo bộ"
                      variant="ghost"
                      onPress={() => router.push("/deck/form")}
                      style={styles.createButton}
                    />
                  </View>
                ) : (
                  <View style={styles.personalList}>
                    {personalDecks.map((deck) => (
                      <Pressable
                        accessibilityHint="Mở bộ từ cá nhân"
                        accessibilityRole="button"
                        key={deck.id}
                        onPress={() =>
                          router.push({
                            pathname: "/deck/[id]",
                            params: { id: deck.id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.personalDeckCard,
                          pressed && styles.resultRowPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.personalDeckIcon,
                            {
                              backgroundColor: resolveDeckColor(
                                deck.color,
                                colors.primary,
                              ),
                            },
                          ]}
                        >
                          <Ionicons name="book" size={22} color="#fff" />
                        </View>
                        <View style={styles.personalDeckCopy}>
                          <Text
                            numberOfLines={1}
                            style={styles.personalDeckTitle}
                          >
                            {deck.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={styles.personalDeckMeta}
                          >
                            {deck.cardCount} thẻ · {deck.sourceLanguage} →{" "}
                            {deck.targetLanguage}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={colors.muted}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </>
      ) : (
        <View style={styles.practiceSection}>
          <View style={styles.practiceHero}>
            <View style={styles.practiceHeroTop}>
              <View style={styles.practiceHeroIcon}>
                <Ionicons name="school" size={28} color="#fff" />
              </View>
              <View style={styles.practiceHeroCopy}>
                <View style={styles.practiceHeroHeaderRow}>
                  <Text style={styles.practiceEyebrow}>BÀI ĐANG CHỌN</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đổi chủ đề muốn ôn tập"
                    onPress={() => setTopicPickerVisible(true)}
                    style={({ pressed }) => [
                      styles.changeTopicBadge,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Ionicons name="swap-horizontal" size={13} color="#fff" />
                    <Text style={styles.changeTopicBadgeText}>Đổi chủ đề</Text>
                  </Pressable>
                </View>
                <Text numberOfLines={2} style={styles.practiceHeroTitle}>
                  {practiceDeck?.title ?? "Chưa có bài học"}
                </Text>
                <Text style={styles.practiceHeroMeta}>
                  {practiceDeck?.cardCount ?? 0} từ ·{" "}
                  {practiceProgress.reviewed} đã học ·{" "}
                  {practiceProgress.mastered} đã thuộc
                </Text>
              </View>
            </View>
            <View style={styles.practiceProgressTrack}>
              <View
                style={[
                  styles.practiceProgressFill,
                  {
                    width: `${practiceDeck?.cardCount ? Math.min(100, (practiceProgress.reviewed / practiceDeck.cardCount) * 100) : 0}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.practiceHeroActions}>
              <Pressable
                disabled={!practiceDeck}
                onPress={() =>
                  practiceDeck &&
                  router.push({
                    pathname: "/review/[deckId]",
                    params: { deckId: practiceDeck.id, mode: "daily" },
                  })
                }
                style={({ pressed }) => [
                  styles.practicePrimaryButton,
                  pressed && styles.resultRowPressed,
                ]}
              >
                <Ionicons name="play" size={19} color={colors.primary} />
                <Text style={styles.practicePrimaryText}>
                  {practiceProgress.reviewed > 0
                    ? "Tiếp tục học"
                    : "Bắt đầu học"}
                </Text>
              </Pressable>
              <Pressable
                disabled={!practiceDeck}
                onPress={() =>
                  practiceDeck && router.push(`/deck/${practiceDeck.id}`)
                }
                style={({ pressed }) => [
                  styles.practiceSecondaryButton,
                  pressed && styles.resultRowPressed,
                ]}
              >
                <Text style={styles.practiceSecondaryText}>Danh sách từ</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={styles.practiceSectionTitle}>Ôn tập thông minh</Text>
            <Text style={styles.practiceSectionHint}>
              Chọn đúng nhóm từ bạn cần củng cố hôm nay.
            </Text>
            <View style={styles.modeGrid}>
              {reviewModes.map((mode) => (
                <Pressable
                  disabled={!practiceDeck}
                  key={mode.id}
                  onPress={() =>
                    practiceDeck &&
                    router.push({
                      pathname: "/review/[deckId]",
                      params: { deckId: practiceDeck.id, mode: mode.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.modeCard,
                    pressed && styles.resultRowPressed,
                  ]}
                >
                  <View style={styles.modeIcon}>
                    <Ionicons
                      name={mode.icon}
                      size={23}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.modeTitle}>{mode.label}</Text>
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.practiceSectionTitle}>Trò chơi luyện tập</Text>
            <Text style={styles.practiceSectionHint}>
              Đổi cách học để ghi nhớ chủ động hơn.
            </Text>
            <View style={styles.modeGrid}>
              {practiceModes.map((mode) => (
                <Pressable
                  disabled={!practiceDeck}
                  key={mode.id}
                  onPress={() =>
                    practiceDeck &&
                    router.push({
                      pathname: "/practice/[deckId]",
                      params: { deckId: practiceDeck.id, mode: mode.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.modeCard,
                    pressed && styles.resultRowPressed,
                  ]}
                >
                  <View style={styles.modeIcon}>
                    <Ionicons
                      name={mode.icon}
                      size={23}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.modeTitle}>{mode.label}</Text>
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Modal
            visible={topicPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setTopicPickerVisible(false)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setTopicPickerVisible(false)}
            >
              <Pressable
                style={[
                  styles.topicPickerSheet,
                  { paddingBottom: Math.max(28, 16 + insets.bottom) },
                ]}
                onPress={() => undefined}
              >
                <View style={styles.topicPickerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topicPickerTitle}>Chọn chủ đề ôn tập</Text>
                    <Text style={styles.topicPickerHint}>
                      Chỉ hiển thị các bài học bạn đã học hoặc hoàn thành.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đóng danh sách chủ đề"
                    hitSlop={8}
                    onPress={() => setTopicPickerVisible(false)}
                  >
                    <Ionicons name="close" size={26} color={colors.muted} />
                  </Pressable>
                </View>
                <ScrollView
                  style={{ flexGrow: 0, maxHeight: 420 }}
                  contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  {(() => {
                    const learnedTopics = categories
                      .flatMap((cat) => cat.topics)
                      .filter((topic) => {
                        const reviewedCount = progressItems.filter(
                          (p) => p.deckId === topic.id && p.lastReviewedAt,
                        ).length;
                        return reviewedCount > 0;
                      });

                    if (learnedTopics.length === 0) {
                      return (
                        <View style={{ padding: 24, alignItems: "center", gap: 10 }}>
                          <Ionicons
                            name="book-outline"
                            size={42}
                            color={colors.muted}
                          />
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: "900",
                              fontSize: 16,
                              textAlign: "center",
                            }}
                          >
                            Chưa có bài học nào được hoàn thành
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Hãy hoàn thành bài học đầu tiên trên Lộ trình để mở tính năng ôn lại chủ đề đã học.
                          </Text>
                        </View>
                      );
                    }

                    return learnedTopics.map((topic) => {
                      const isSelected = topic.id === practiceDeck?.id;
                      const stats = progressItems.reduce(
                        (acc, p) => {
                          if (p.deckId === topic.id && p.lastReviewedAt) {
                            acc.reviewed += 1;
                            if (p.mastered) acc.mastered += 1;
                          }
                          return acc;
                        },
                        { reviewed: 0, mastered: 0 },
                      );
                      const isCompleted =
                        stats.reviewed >= topic.cardCount && topic.cardCount > 0;
                      return (
                        <Pressable
                          key={topic.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            setSelectedPracticeDeckId(topic.id);
                            setTopicPickerVisible(false);
                          }}
                          style={({ pressed }) => [
                            styles.topicPickerItem,
                            isSelected && styles.topicPickerItemSelected,
                            pressed && styles.resultRowPressed,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.topicPickerItemTitle,
                                isSelected && { color: colors.primary },
                              ]}
                            >
                              Bài {topic.pathOrder} · {topic.topic}
                            </Text>
                            <Text style={styles.topicPickerItemMeta}>
                              {topic.cardCount} từ · {stats.reviewed} đã học ·{" "}
                              {stats.mastered} đã thuộc
                              {isCompleted ? " · ✓ Đã hoàn thành" : ""}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={24}
                              color={colors.primary}
                            />
                          ) : (
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={colors.muted}
                            />
                          )}
                        </Pressable>
                      );
                    });
                  })()}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    screen: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      paddingBottom: 34,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 112,
      marginHorizontal: -20,
      marginTop: -20,
      paddingHorizontal: 20,
      paddingBottom: 18,
      backgroundColor: colors.header,
    },
    headerCopy: { flex: 1, paddingRight: 12 },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.78)", marginTop: 5 },
    headerIcon: {
      width: 49,
      height: 49,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerIconActive: { backgroundColor: "rgba(255,255,255,0.28)" },
    segmentedControl: {
      flexDirection: "row",
      minHeight: 58,
      marginHorizontal: -20,
      marginTop: -16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    segmentedControlPinned: {
      width: "100%",
      maxWidth: 620,
      marginHorizontal: 0,
      marginTop: 0,
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
    pinnedTabsLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    segmentButton: {
      minHeight: 58,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    segmentButtonSelected: { borderBottomColor: colors.primary },
    segmentText: { color: colors.muted, fontSize: 14, fontWeight: "900" },
    segmentTextSelected: { color: colors.primary },
    searchSection: {
      gap: 9,
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    searchHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    searchLabel: { color: colors.text, fontSize: 15, fontWeight: "900" },
    searchMeta: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    searchBox: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      backgroundColor: colors.background,
    },
    searchIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 11,
      backgroundColor: colors.primarySoft,
    },
    searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 14 },
    todayCard: {
      gap: 14,
      padding: 17,
      borderRadius: 22,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    todayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    todayHeadingCopy: { flex: 1 },
    todayEyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.9,
    },
    todayTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 2,
    },
    todaySubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
    quickStudyButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    quickStudyText: { color: "#fff", fontSize: 12, fontWeight: "900" },
    todayWords: { gap: 10, paddingRight: 3 },
    todayWord: {
      width: 158,
      minHeight: 150,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.background,
    },
    todayWordTop: {
      minHeight: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    todayWordStatus: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
    },
    todayWordTerm: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 8,
    },
    todayWordMeaning: {
      minHeight: 38,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    todaySpeaker: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-end",
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
    },
    filterSection: { gap: 8 },
    filterHeader: {
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    filterLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
    filterContent: { gap: 8, paddingRight: 4 },
    filterChip: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.primarySoft,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    filterChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    filterChipText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    filterChipTextSelected: { color: "#fff" },
    filterError: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.dangerSoft,
    },
    filterErrorText: {
      flex: 1,
      color: colors.danger,
      fontSize: 12,
      lineHeight: 17,
    },
    retryText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
    hero: {
      padding: 20,
      gap: 13,
      borderRadius: 24,
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    heroBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    heroBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },
    heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
    heroDescription: { color: "#D8F7F8", lineHeight: 21 },
    infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    infoItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 11,
      backgroundColor: "rgba(255,255,255,0.13)",
    },
    infoText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 10, marginTop: 2 },
    actionButton: { flex: 1 },
    catalogSection: { gap: 10 },
    catalogOverview: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      padding: 15,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    catalogOverviewIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    catalogContents: { gap: 10 },
    catalogHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 4,
    },
    catalogHeadingCopy: { flex: 1 },
    catalogTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
    catalogListTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    catalogSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
    expandAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
    },
    expandAllText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    categoryCard: {
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    categoryHeader: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    categoryCopy: { flex: 1 },
    categoryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    categoryMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    topicList: {
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    topicRow: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topicRowLast: { borderBottomWidth: 0 },
    topicCopy: { flex: 1, paddingVertical: 9 },
    topicTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    topicMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
    previewCard: {
      padding: 17,
      borderRadius: 20,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    resultsCard: {
      padding: 17,
      borderRadius: 20,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 7,
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    previewCount: { color: colors.primary, fontWeight: "800" },
    sortSelect: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      marginBottom: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    sortSelectText: { color: colors.text, fontSize: 13, fontWeight: "900" },
    sortValue: {
      flex: 1,
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "right",
    },
    sortMenu: {
      overflow: "hidden",
      marginBottom: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    sortOption: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sortOptionSelected: { backgroundColor: colors.primarySoft },
    sortOptionText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    resultRow: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultRowPressed: { opacity: 0.65 },
    resultContent: { flex: 1, gap: 3 },
    resultTopLine: { flexDirection: "row", alignItems: "baseline", gap: 7 },
    resultTerm: {
      maxWidth: "62%",
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    pronunciation: { flex: 1, color: colors.muted, fontSize: 12 },
    resultMeaning: { color: colors.text, lineHeight: 19 },
    resultTopic: { color: colors.muted, fontSize: 11 },
    speakerButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    speakerButtonPressed: { opacity: 0.55 },
    favoriteButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: colors.dangerSoft,
    },
    emptyState: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 34,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    emptyText: {
      maxWidth: 310,
      color: colors.muted,
      lineHeight: 20,
      marginTop: 6,
      textAlign: "center",
    },
    loadMoreButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 12,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
    },
    loadMoreText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
    wordRow: {
      minHeight: 55,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    wordRowLast: { borderBottomWidth: 0 },
    wordNumber: {
      width: 27,
      height: 27,
      borderRadius: 9,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    wordNumberText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    wordTerm: { width: 80, color: colors.text, fontWeight: "900" },
    wordMeaning: { flex: 1, color: colors.muted, lineHeight: 18 },
    previewSpeakerButton: {
      width: 35,
      height: 35,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    personalSection: { gap: 11, marginTop: 2 },
    personalHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    personalHeadingCopy: { flex: 1 },
    addPersonalButton: {
      width: 47,
      height: 47,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    personalState: {
      minHeight: 140,
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      padding: 18,
      borderRadius: 20,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    personalStateText: {
      color: colors.muted,
      lineHeight: 20,
      textAlign: "center",
    },
    personalList: { gap: 9 },
    personalDeckCard: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    personalDeckIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    personalDeckCopy: { flex: 1, gap: 4 },
    personalDeckTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    personalDeckMeta: { color: colors.muted, fontSize: 12 },
    customCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.warningSoft,
    },
    customIcon: {
      width: 45,
      height: 45,
      borderRadius: 15,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    customCopy: { flex: 1 },
    customTitle: { color: colors.text, fontWeight: "900" },
    customText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    createButton: { minHeight: 42, paddingHorizontal: 12 },
    practiceSection: { gap: 22 },
    practiceHero: {
      gap: 16,
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    practiceHeroTop: { flexDirection: "row", alignItems: "center", gap: 13 },
    practiceHeroIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.17)",
    },
    practiceHeroCopy: { flex: 1, gap: 3 },
    practiceEyebrow: {
      color: "rgba(255,255,255,0.76)",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },
    practiceHeroTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
    practiceHeroMeta: { color: "rgba(255,255,255,0.78)", fontSize: 12 },
    practiceProgressTrack: {
      height: 8,
      overflow: "hidden",
      borderRadius: 99,
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    practiceProgressFill: {
      height: "100%",
      borderRadius: 99,
      backgroundColor: "#fff",
    },
    practiceHeroActions: { flexDirection: "row", gap: 9 },
    practicePrimaryButton: {
      minHeight: 48,
      flex: 1.15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 15,
      backgroundColor: "#fff",
    },
    practicePrimaryText: { color: colors.primary, fontWeight: "900" },
    practiceSecondaryButton: {
      minHeight: 48,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.42)",
      borderRadius: 15,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    practiceSecondaryText: { color: "#fff", fontWeight: "900" },
    practiceSectionTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900",
    },
    practiceSectionHint: { color: colors.muted, fontSize: 13, marginTop: 3 },
    modeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 12,
    },
    modeCard: {
      width: "48%",
      minHeight: 132,
      flexGrow: 1,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 19,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    modeIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      backgroundColor: colors.primarySoft,
    },
    modeTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    modeDescription: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },
    practiceHeroHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    changeTopicBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.22)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.35)",
    },
    changeTopicBadgeText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(6, 52, 73, 0.44)",
    },
    topicPickerSheet: {
      maxHeight: "82%",
      padding: 20,
      paddingBottom: 28,
      gap: 16,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surface,
    },
    topicPickerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    topicPickerTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: "900",
    },
    topicPickerHint: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 3,
    },
    topicPickerItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    topicPickerItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    topicPickerItemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    topicPickerItemMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
  });
