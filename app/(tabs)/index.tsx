import { AppScreen } from "@/src/components/AppScreen";
import { EmptyView, ErrorView, LoadingView } from "@/src/components/StateView";
import { useAuth } from "@/src/context/AuthContext";
import {
  getLearningStats,
  listDeckStates,
  listOwnedDecks,
  listOwnedDecksFromCache,
} from "@/src/services/deckService";
import { colors, shadows } from "@/src/theme/colors";
import type { Deck, DeckState, LearningStats } from "@/src/types/models";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
const emptyStats: LearningStats = {
  totalDecks: 0,
  totalCards: 0,
  mastered: 0,
  due: 0,
  learning: 0,
  reviewedLast7Days: 0,
};
const TOPIC_PATH_ID = "en-vi-word-topics-v1";
const PATH_OFFSETS = [-82, -30, 48, 84, 30, -48, -86, -36, 44, 82, 24, -56];

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<LearningStats>(emptyStats);
  const [deckStates, setDeckStates] = useState<Record<string, DeckState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [sectionPickerVisible, setSectionPickerVisible] = useState(false);
  const [stickyCategoryOrder, setStickyCategoryOrder] = useState<number | null>(null);
  const hasLoaded = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const roadTopRef = useRef(0);
  const sectionOffsetsRef = useRef<Record<number, number>>({});

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent && !hasLoaded.current) setLoading(true);
      setError("");
      let hasVisibleData = hasLoaded.current;
      try {
        const cached = await listOwnedDecksFromCache(user.uid);
        if (cached.length > 0 || hasLoaded.current) {
          setDecks(cached);
          setLoading(false);
          hasVisibleData = true;
        }
        const fresh = await listOwnedDecks(user.uid);
        setDecks(fresh);
        hasLoaded.current = true;
        Promise.all([
          getLearningStats(user.uid, fresh),
          listDeckStates(user.uid),
        ])
          .then(([nextStats, nextStates]) => {
            setStats(nextStats);
            setDeckStates(nextStates);
          })
          .catch(() => undefined);
      } catch (e) {
        if (!hasVisibleData) setError(friendlyError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pathDecks = useMemo(
    () => decks
      .filter((deck) => deck.pathId === TOPIC_PATH_ID)
      .sort((left, right) => (left.pathOrder ?? 0) - (right.pathOrder ?? 0)),
    [decks],
  );
  const personalDecks = useMemo(
    () => decks.filter((deck) => deck.pathId !== TOPIC_PATH_ID),
    [decks],
  );
  const pathSections = useMemo(() => {
    const sections: { categoryOrder: number; categoryTitle: string }[] = [];
    const seen = new Set<number>();
    pathDecks.forEach((deck) => {
      const categoryOrder = deck.categoryOrder ?? 0;
      if (seen.has(categoryOrder)) return;
      seen.add(categoryOrder);
      sections.push({ categoryOrder, categoryTitle: deck.categoryTitle || deck.topic });
    });
    return sections;
  }, [pathDecks]);

  const stickySection = pathSections.find(
    (section) => section.categoryOrder === stickyCategoryOrder,
  );

  const updateStickySection = useCallback((scrollY: number) => {
    let nextCategoryOrder: number | null = null;
    for (const section of pathSections) {
      const sectionOffset = sectionOffsetsRef.current[section.categoryOrder];
      if (sectionOffset === undefined) continue;
      if (scrollY + 4 >= roadTopRef.current + sectionOffset) {
        nextCategoryOrder = section.categoryOrder;
      } else {
        break;
      }
    }
    setStickyCategoryOrder((current) => current === nextCategoryOrder ? current : nextCategoryOrder);
  }, [pathSections]);

  function jumpToSection(categoryOrder: number) {
    const sectionOffset = sectionOffsetsRef.current[categoryOrder];
    if (sectionOffset === undefined) return;
    setSectionPickerVisible(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, roadTopRef.current + sectionOffset),
        animated: true,
      });
    });
  }

  function isUnlocked(deck: Deck) {
    if (deck.pathId !== TOPIC_PATH_ID) return true;
    const index = pathDecks.findIndex((item) => item.id === deck.id);
    if (index <= 0) return true;
    const previous = pathDecks[index - 1];
    const reviewed = deckStates[previous.id]?.reviewedCardCount ?? 0;
    return previous.cardCount > 0 && reviewed / previous.cardCount >= 0.8;
  }

  const activeDeck =
    pathDecks.find((deck) => {
      const reviewed = deckStates[deck.id]?.reviewedCardCount ?? 0;
      const completion = deck.cardCount ? reviewed / deck.cardCount : 0;
      return deck.cardCount > 0 && isUnlocked(deck) && completion < 0.8;
    }) ??
    pathDecks[0] ??
    personalDecks.find((deck) => deck.cardCount > 0);

  function startTodayLesson() {
    if (activeDeck) router.push(`/review/${activeDeck.id}`);
    else router.push("/deck/form");
  }

  const masteredPercent = stats.totalCards
    ? Math.round((stats.mastered / stats.totalCards) * 100)
    : 0;
  const todayTarget = Math.min(
    stats.dailyGoal ?? 30,
    (stats.due ?? 0) +
      Math.min(10, stats.newAvailable ?? 0) +
      Math.min(5, stats.hardCount ?? 0),
  );
  const todayProgress = Math.min(
    stats.reviewedToday ?? 0,
    stats.dailyGoal ?? 30,
  );
  const todayPercent = Math.round(
    (todayProgress / (stats.dailyGoal ?? 30)) * 100,
  );

  return (
    <AppScreen
      contentStyle={styles.screen}
      scrollRef={scrollRef}
      scrollProps={{
        onScroll: (event) => updateStickySection(event.nativeEvent.contentOffset.y),
        scrollEventThrottle: 16,
      }}
      floatingContent={stickySection ? (
        <View
          pointerEvents="box-none"
          style={[styles.stickySectionWrapper, { top: insets.top + 8 }]}>
          <View style={styles.stickySectionBanner}>
            <View style={styles.stickySectionIcon}>
              <Ionicons name="flag" size={21} color="#fff" />
            </View>
            <View style={styles.sectionBannerCopy}>
              <Text style={styles.sectionOverline}>PHẦN {stickySection.categoryOrder}</Text>
              <Text style={styles.sectionTitle}>{stickySection.categoryTitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn phần học"
              hitSlop={8}
              onPress={() => setSectionPickerVisible(true)}
              style={({ pressed }) => [styles.sectionListButton, pressed && styles.stopPressed]}>
              <Ionicons name="list" size={29} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : null}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.topBar}>
        <View style={styles.languageBadge}>
          <Ionicons name="language" size={22} color={colors.primary} />
          <Text style={styles.languageText}>ANH–VIỆT</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="flame" size={23} color={colors.warning} />
          <Text style={styles.metricValue}>{stats.streak ?? 0}</Text>
        </View>
        <View style={styles.metric}>
          <View>
            <Text style={[styles.knLabel, { fontSize: 16 }]}>KN</Text>
          </View>
          <Text style={[styles.metricValue, styles.xpValue]}>
            {stats.xp ?? 0}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.displayName || user?.email || "L")
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.courseBanner}>
        <View style={styles.courseBannerIcon}>
          <Ionicons name="map" size={29} color="#fff" />
        </View>
        <View style={styles.courseBannerCopy}>
          <Text style={styles.courseOverline}>LỘ TRÌNH TỪ VỰNG</Text>
          <Text style={styles.courseTitle}>Chinh phục 3.000 từ Anh–Việt</Text>
          <Text style={styles.courseMeta}>
            {pathDecks.length} bài học ·{" "}
            {stats.mastered.toLocaleString("vi-VN")} từ đã thuộc
          </Text>
        </View>
        <View style={styles.coursePercent}>
          <Text style={styles.coursePercentText}>{masteredPercent}%</Text>
        </View>
      </View>

      <View style={styles.missionCard}>
        <View style={styles.missionIcon}>
          <Ionicons name="flag" size={27} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.missionOverline}>NHIỆM VỤ HÔM NAY</Text>
          <Text style={styles.missionTitle}>
            {todayProgress >= (stats.dailyGoal ?? 30)
              ? "Đã hoàn thành mục tiêu hôm nay!"
              : `${todayTarget || 10} thẻ · khoảng ${Math.max(3, Math.ceil((todayTarget || 10) / 4))} phút`}
          </Text>
          <Text style={styles.missionMeta}>
            {todayProgress}/{stats.dailyGoal ?? 30} thẻ · {stats.due ?? 0} đến
            hạn · {Math.min(10, stats.newAvailable ?? 0)} từ mới
          </Text>
          <View style={styles.missionTrack}>
            <View
              style={[
                styles.missionFill,
                { width: `${Math.min(todayPercent, 100)}%` },
              ]}
            />
          </View>
        </View>
        <Pressable style={styles.goButton} onPress={startTodayLesson}>
          <Text style={styles.goText}>ĐI</Text>
        </Pressable>
      </View>

      <View style={styles.journeyHeader}>
        <View>
          <Text style={styles.journeyTitle}>Đường học của bạn</Text>
          <Text style={styles.journeyHint}>
            Hoàn thành 80% để mở bài kế tiếp
          </Text>
        </View>
        <Ionicons name="footsteps" size={26} color={colors.primary} />
      </View>

      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={() => load()} />
      ) : decks.length === 0 ? (
        <EmptyView
          title="Chưa có chặng học"
          message="Tạo bộ từ đầu tiên hoặc cài kho 3.000 từ có sẵn."
          actionTitle="Tạo chặng đầu tiên"
          onAction={() => router.push("/deck/form")}
        />
      ) : (
        <View
          style={styles.road}
          onLayout={(event) => {
            roadTopRef.current = event.nativeEvent.layout.y;
          }}>
          <View style={styles.roadLine} />
          {pathDecks.map((deck, index) => {
            const unlocked = isUnlocked(deck);
            const reviewed = deckStates[deck.id]?.reviewedCardCount ?? 0;
            const lessonPercent = deck.cardCount
              ? Math.min(100, Math.round((reviewed / deck.cardCount) * 100))
              : 0;
            const completed = lessonPercent >= 80;
            const active = activeDeck?.id === deck.id;
            const previousDeck = pathDecks[index - 1];
            const showSection =
              index === 0 || deck.categoryTitle !== previousDeck?.categoryTitle;
            const checkpoint = (index + 1) % 5 === 0;
            const nodeColor = completed
              ? colors.success
              : unlocked
                ? colors.primary
                : "#A9A8B7";
            const nodeIcon = !unlocked
              ? "lock-closed"
              : completed
                ? "checkmark"
                : active
                  ? "play"
                  : checkpoint
                    ? "star"
                    : "book";
            const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];
            return (
              <View
                key={deck.id}
                style={styles.roadStep}
                onLayout={showSection ? (event) => {
                  sectionOffsetsRef.current[deck.categoryOrder ?? 0] = event.nativeEvent.layout.y + 16;
                } : undefined}>
                {showSection ? (
                  <View style={styles.sectionBanner}>
                    <View style={styles.sectionBannerIcon}>
                      <Ionicons name="flag" size={20} color="#fff" />
                    </View>
                    <View style={styles.sectionBannerCopy}>
                      <Text style={styles.sectionOverline}>
                        PHẦN {deck.categoryOrder}
                      </Text>
                      <Text style={styles.sectionTitle}>
                        {deck.categoryTitle}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Chọn phần học"
                      hitSlop={8}
                      onPress={() => setSectionPickerVisible(true)}
                      style={({ pressed }) => [styles.sectionListButton, pressed && styles.stopPressed]}>
                      <Ionicons name="list" size={26} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.pathNodeRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !unlocked }}
                    disabled={!unlocked}
                    onPress={() => setSelectedDeck(deck)}
                    style={({ pressed }) => [
                      styles.pathNodePressable,
                      { transform: [{ translateX: offset }] },
                      pressed && styles.stopPressed,
                    ]}
                  >
                    {active ? <View style={styles.activeRing} /> : null}
                    <View
                      style={[
                        styles.nodeShadow,
                        {
                          backgroundColor: completed
                            ? "#207B5A"
                            : unlocked
                              ? colors.primaryDark
                              : "#7E7D8D",
                        },
                      ]}
                    >
                      <View
                        style={[styles.node, { backgroundColor: nodeColor }]}
                      >
                        <Ionicons
                          name={nodeIcon}
                          size={checkpoint ? 31 : 29}
                          color="#fff"
                        />
                      </View>
                    </View>
                    {checkpoint ? (
                      <View style={styles.checkpointBadge}>
                        <Ionicons
                          name="star"
                          size={10}
                          color={colors.warning}
                        />
                        <Text style={styles.checkpointText}>KIỂM TRA</Text>
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.nodeLabel,
                        !unlocked && styles.nodeLabelLocked,
                      ]}
                      numberOfLines={2}
                    >
                      Bài {deck.pathOrder} · {deck.topic}
                    </Text>
                    <Text style={styles.nodeMeta}>
                      {deck.cardCount} từ · {lessonPercent}%
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <View style={styles.finishStop}>
            <Ionicons name="trophy" size={32} color={colors.warning} />
            <Text style={styles.finishText}>Chinh phục toàn bộ lộ trình!</Text>
          </View>
        </View>
      )}

      {personalDecks.length ? (
        <View style={styles.personalSection}>
          <View style={styles.personalHeader}>
            <View>
              <Text style={styles.journeyTitle}>Bộ từ cá nhân</Text>
              <Text style={styles.journeyHint}>Lộ trình riêng do bạn tạo</Text>
            </View>
            <Pressable
              style={styles.addPersonalButton}
              onPress={() => router.push("/deck/form")}
            >
              <Ionicons name="add" size={23} color="#fff" />
            </Pressable>
          </View>
          {personalDecks.map((deck) => (
            <Pressable
              key={deck.id}
              onPress={() => setSelectedDeck(deck)}
              style={({ pressed }) => [
                styles.personalCard,
                pressed && styles.stopPressed,
              ]}
            >
              <View
                style={[
                  styles.personalIcon,
                  { backgroundColor: deck.color || colors.primary },
                ]}
              >
                <Ionicons name="layers" size={23} color="#fff" />
              </View>
              <View style={styles.personalCopy}>
                <Text style={styles.personalTitle}>{deck.title}</Text>
                <Text style={styles.personalMeta}>
                  {deck.cardCount} thẻ · Chạm để học
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Modal
        visible={Boolean(selectedDeck)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDeck(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedDeck(null)}
        >
          <Pressable style={styles.lessonSheet} onPress={() => undefined}>
            {selectedDeck ? (
              <>
                <View style={styles.sheetHeader}>
                  <View
                    style={[
                      styles.sheetIcon,
                      { backgroundColor: selectedDeck.color || colors.primary },
                    ]}
                  >
                    <Ionicons name="book" size={27} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selectedDeck.title}</Text>
                    <Text style={styles.sheetMeta}>
                      {deckStates[selectedDeck.id]?.reviewedCardCount ?? 0}/
                      {selectedDeck.cardCount} đã học ·{" "}
                      {deckStates[selectedDeck.id]?.masteredCount ?? 0} đã thuộc
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedDeck(null)}>
                    <Ionicons name="close" size={25} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={styles.sheetProgress}>
                  <View
                    style={[
                      styles.sheetProgressFill,
                      {
                        width: `${selectedDeck.cardCount ? Math.min(100, ((deckStates[selectedDeck.id]?.reviewedCardCount ?? 0) / selectedDeck.cardCount) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.sheetActions}>
                  <Pressable
                    style={styles.primaryAction}
                    onPress={() => {
                      setSelectedDeck(null);
                      router.push({
                        pathname: "/review/[deckId]",
                        params: { deckId: selectedDeck.id, mode: "daily" },
                      });
                    }}
                  >
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={styles.primaryActionText}>
                      {(deckStates[selectedDeck.id]?.reviewedCardCount ?? 0) > 0
                        ? "Tiếp tục học"
                        : "Bắt đầu học"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={() => {
                      setSelectedDeck(null);
                      router.push(`/deck/${selectedDeck.id}`);
                    }}
                  >
                    <Text style={styles.secondaryActionText}>Danh sách từ</Text>
                  </Pressable>
                </View>
                <Text style={styles.practiceTitle}>Luyện tập nhanh</Text>
                <View style={styles.practiceGrid}>
                  {[
                    ["mistakes", "close-circle", "Từ sai"],
                    ["hard", "fitness", "Từ khó"],
                    ["due", "time", "Đến hạn"],
                    ["new", "sparkles", "Từ mới"],
                  ].map(([mode, icon, label]) => (
                    <Pressable
                      key={mode}
                      style={styles.practiceItem}
                      onPress={() => {
                        setSelectedDeck(null);
                        router.push({
                          pathname: "/review/[deckId]",
                          params: { deckId: selectedDeck.id, mode },
                        });
                      }}
                    >
                      <Ionicons
                        name={icon as keyof typeof Ionicons.glyphMap}
                        size={21}
                        color={colors.primary}
                      />
                      <Text style={styles.practiceText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.practiceGrid}>
                  {[
                    ["quiz", "help-circle", "Trắc nghiệm"],
                    ["match", "git-compare", "Ghép cặp"],
                    ["write", "create", "Nhập từ"],
                  ].map(([mode, icon, label]) => (
                    <Pressable
                      key={mode}
                      style={styles.practiceItem}
                      onPress={() => {
                        setSelectedDeck(null);
                        router.push({
                          pathname: "/practice/[deckId]",
                          params: { deckId: selectedDeck.id, mode },
                        });
                      }}
                    >
                      <Ionicons
                        name={icon as keyof typeof Ionicons.glyphMap}
                        size={21}
                        color={colors.primary}
                      />
                      <Text style={styles.practiceText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={sectionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSectionPickerVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSectionPickerVisible(false)}>
          <Pressable style={styles.sectionPickerSheet} onPress={() => undefined}>
            <View style={styles.sectionPickerHeader}>
              <View>
                <Text style={styles.sectionPickerTitle}>Chọn phần học</Text>
                <Text style={styles.sectionPickerHint}>Chuyển nhanh đến nhóm chủ đề bạn muốn học.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng danh sách phần học"
                hitSlop={8}
                onPress={() => setSectionPickerVisible(false)}>
                <Ionicons name="close" size={26} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sectionPickerScroll}
              contentContainerStyle={styles.sectionPickerList}
              showsVerticalScrollIndicator={false}>
              {pathSections.map((section) => {
                const selected = section.categoryOrder === (stickyCategoryOrder ?? pathSections[0]?.categoryOrder);
                return (
                  <Pressable
                    key={section.categoryOrder}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => jumpToSection(section.categoryOrder)}
                    style={({ pressed }) => [
                      styles.sectionPickerItem,
                      selected && styles.sectionPickerItemSelected,
                      pressed && styles.stopPressed,
                    ]}>
                    <View style={[styles.sectionPickerNumber, selected && styles.sectionPickerNumberSelected]}>
                      <Text style={[styles.sectionPickerNumberText, selected && styles.sectionPickerNumberTextSelected]}>
                        {section.categoryOrder}
                      </Text>
                    </View>
                    <View style={styles.sectionBannerCopy}>
                      <Text style={styles.sectionPickerOverline}>PHẦN {section.categoryOrder}</Text>
                      <Text style={styles.sectionPickerItemTitle}>{section.categoryTitle}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "chevron-forward"}
                      size={23}
                      color={selected ? colors.primary : colors.muted}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingBottom: 36,
  },
  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  languageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  languageText: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  metric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: "900" },

  knLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  xpValue: { color: "#278AC2" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  avatarText: { color: colors.primary, fontWeight: "900", fontSize: 17 },
  courseBanner: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 17,
    borderRadius: 23,
    borderBottomWidth: 6,
    borderBottomColor: colors.primaryDark,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  courseBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
  },
  courseBannerCopy: { flex: 1 },
  courseOverline: {
    color: "#C9F5F7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  courseTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 3,
  },
  courseMeta: { color: "#DDF9FA", fontSize: 11, marginTop: 5 },
  coursePercent: {
    minWidth: 49,
    height: 49,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.65)",
  },
  coursePercentText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  missionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#C5EFF2",
  },
  missionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  missionOverline: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  missionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },
  missionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  missionTrack: {
    height: 6,
    borderRadius: 8,
    backgroundColor: "#BCE7EC",
    overflow: "hidden",
    marginTop: 9,
  },
  missionFill: { height: "100%", backgroundColor: colors.primary },
  goButton: {
    minWidth: 60,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  goText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  journeyTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
  journeyHint: { color: colors.muted, marginTop: 4 },
  road: { position: "relative", paddingTop: 5, paddingBottom: 12 },
  roadLine: {
    position: "absolute",
    top: 82,
    bottom: 62,
    left: "50%",
    borderLeftWidth: 6,
    borderStyle: "dashed",
    borderColor: "#D5EBEF",
  },
  roadStep: { width: "100%" },
  sectionBanner: {
    zIndex: 3,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 20,
    borderBottomWidth: 5,
    borderBottomColor: colors.primaryDark,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  sectionListButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  stickySectionWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 12,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  stickySectionBanner: {
    width: "100%",
    maxWidth: 620,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomWidth: 5,
    borderBottomColor: colors.primaryDark,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  stickySectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  sectionBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  sectionBannerCopy: { flex: 1 },
  sectionOverline: {
    color: "#C9F5F7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  pathNodeRow: { height: 138, position: "relative", alignItems: "center" },
  pathNodePressable: {
    position: "absolute",
    top: 5,
    left: "50%",
    width: 176,
    marginLeft: -88,
    alignItems: "center",
  },
  activeRing: {
    position: "absolute",
    top: -10,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 8,
    borderColor: "#BCECF1",
    backgroundColor: "rgba(8,122,155,0.08)",
  },
  nodeShadow: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 0,
    marginBottom: 5,
  },
  node: {
    width: 84,
    height: 76,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  stopPressed: { opacity: 0.72 },
  checkpointBadge: {
    position: "absolute",
    top: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.warningSoft,
  },
  checkpointText: { color: colors.warning, fontSize: 8, fontWeight: "900" },
  nodeLabel: {
    maxWidth: 172,
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 17,
  },
  nodeLabelLocked: { color: colors.muted },
  nodeMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  finishStop: {
    zIndex: 2,
    alignSelf: "center",
    minWidth: 210,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 15,
    borderRadius: 19,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  finishText: { color: colors.primary, fontWeight: "900" },
  personalSection: { gap: 10, paddingTop: 8 },
  personalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addPersonalButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  personalCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  personalIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  personalCopy: { flex: 1 },
  personalTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  personalMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,52,73,0.44)",
  },
  sectionPickerSheet: {
    maxHeight: "78%",
    padding: 20,
    paddingBottom: 28,
    gap: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  sectionPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionPickerTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  sectionPickerHint: { color: colors.muted, marginTop: 4 },
  sectionPickerScroll: { flexGrow: 0 },
  sectionPickerList: { gap: 9, paddingBottom: 4 },
  sectionPickerItem: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  sectionPickerItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  sectionPickerNumber: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  sectionPickerNumberSelected: { backgroundColor: colors.primary },
  sectionPickerNumberText: { color: colors.primary, fontWeight: "900" },
  sectionPickerNumberTextSelected: { color: "#fff" },
  sectionPickerOverline: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionPickerItemTitle: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 },
  lessonSheet: {
    padding: 20,
    paddingBottom: 32,
    gap: 15,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  sheetMeta: { color: colors.muted, marginTop: 3 },
  sheetProgress: {
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  sheetProgressFill: { height: "100%", backgroundColor: colors.success },
  sheetActions: { flexDirection: "row", gap: 10 },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  primaryActionText: { color: "#fff", fontWeight: "900" },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  secondaryActionText: { color: colors.primary, fontWeight: "900" },
  practiceTitle: { color: colors.text, fontWeight: "900" },
  practiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  practiceItem: {
    flexGrow: 1,
    minWidth: "22%",
    minHeight: 54,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: colors.background,
  },
  practiceText: { color: colors.text, fontSize: 11, fontWeight: "800" },
});
