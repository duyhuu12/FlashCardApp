import { AppScreen } from "@/src/components/AppScreen";
import { EmptyView, ErrorView, LoadingView } from "@/src/components/StateView";
import { getAvatarSource } from "@/src/constants/avatarOptions";
import { useAuth } from "@/src/context/AuthContext";
import {
  getLearningStats,
  listDeckStates,
  listOwnedDecks,
  listOwnedDecksFromCache,
} from "@/src/services/deckService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { Deck, DeckState, LearningStats } from "@/src/types/models";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const emptyStats: LearningStats = {
  totalDecks: 0,
  totalCards: 0,
  mastered: 0,
  due: 0,
  learning: 0,
  reviewedLast7Days: 0,
};
const TOPIC_PATH_ID = "en-vi-word-topics-v1";
const STICKY_SECTION_TRIGGER_OFFSET = 82;
const PATH_OFFSETS = [-82, -30, 48, 84, 30, -48, -86, -36, 44, 82, 24, -56];
const SECTION_PALETTES = [
  { main: "#1687A7", dark: "#0D637B" },
  { main: "#6B63D9", dark: "#4F48B4" },
  { main: "#D47732", dark: "#A9561D" },
  { main: "#2F9A72", dark: "#217456" },
  { main: "#C85C86", dark: "#9D3E67" },
  { main: "#5B77C8", dark: "#3F579E" },
  { main: "#A05EB5", dark: "#7D438F" },
  { main: "#BF6A49", dark: "#934B31" },
  { main: "#508A36", dark: "#376921" },
  { main: "#B25C72", dark: "#884356" },
] as const;

function getSectionPalette(categoryOrder?: number | null) {
  const index = Math.max(0, (categoryOrder ?? 1) - 1) % SECTION_PALETTES.length;
  return SECTION_PALETTES[index];
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
  const [stickyCategoryOrder, setStickyCategoryOrder] = useState<number | null>(
    null,
  );
  const hasLoaded = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const roadTopRef = useRef(0);
  const sectionOffsetsRef = useRef<Record<number, number>>({});
  const activePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(activePulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [activePulse]);

  const activeRingAnimation = {
    opacity: activePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 0.28],
    }),
    transform: [
      {
        scale: activePulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.17],
        }),
      },
    ],
  };

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
    () =>
      decks
        .filter((deck) => deck.pathId === TOPIC_PATH_ID)
        .sort((left, right) => (left.pathOrder ?? 0) - (right.pathOrder ?? 0)),
    [decks],
  );
  const pathSections = useMemo(() => {
    const sections: { categoryOrder: number; categoryTitle: string }[] = [];
    const seen = new Set<number>();
    pathDecks.forEach((deck) => {
      const categoryOrder = deck.categoryOrder ?? 0;
      if (seen.has(categoryOrder)) return;
      seen.add(categoryOrder);
      sections.push({
        categoryOrder,
        categoryTitle: deck.categoryTitle || deck.topic,
      });
    });
    return sections;
  }, [pathDecks]);

  const stickySection = pathSections.find(
    (section) => section.categoryOrder === stickyCategoryOrder,
  );
  const stickyPalette = getSectionPalette(stickySection?.categoryOrder);

  const updateStickySection = useCallback(
    (scrollY: number) => {
      let nextCategoryOrder: number | null = null;
      for (const section of pathSections) {
        const sectionOffset = sectionOffsetsRef.current[section.categoryOrder];
        if (sectionOffset === undefined) continue;
        if (
          scrollY + STICKY_SECTION_TRIGGER_OFFSET >=
          roadTopRef.current + sectionOffset
        ) {
          nextCategoryOrder = section.categoryOrder;
        } else {
          break;
        }
      }
      setStickyCategoryOrder((current) =>
        current === nextCategoryOrder ? current : nextCategoryOrder,
      );
    },
    [pathSections],
  );

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
    pathDecks[0];
  const selectedDeckState = selectedDeck
    ? deckStates[selectedDeck.id]
    : undefined;
  const selectedDeckPercent = selectedDeck?.cardCount
    ? Math.min(
        100,
        Math.round(
          ((selectedDeckState?.reviewedCardCount ?? 0) /
            selectedDeck.cardCount) *
            100,
        ),
      )
    : 0;
  const selectedDeckCompleted = selectedDeckPercent >= 80;
  const selectedDeckGold = Boolean(selectedDeckState?.goldCompletedAt);

  return (
    <AppScreen
      contentStyle={styles.screen}
      scrollRef={scrollRef}
      scrollProps={{
        onScroll: (event) =>
          updateStickySection(event.nativeEvent.contentOffset.y),
        scrollEventThrottle: 16,
      }}
      floatingContent={
        stickySection ? (
          <View
            pointerEvents="box-none"
            style={[styles.stickySectionWrapper, { top: insets.top + 8 }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn phần học, phần ${stickySection.categoryOrder} ${stickySection.categoryTitle}`}
              onPress={() => setSectionPickerVisible(true)}
              style={[
                styles.stickySectionBanner,
                {
                  backgroundColor: stickyPalette.main,
                  borderBottomColor: stickyPalette.dark,
                },
              ]}
            >
              <View style={styles.stickySectionIcon}>
                <Ionicons name="flag" size={21} color="#fff" />
              </View>
              <View style={styles.sectionBannerCopy}>
                <Text style={styles.sectionOverline}>
                  PHẦN {stickySection.categoryOrder}
                </Text>
                <Text style={styles.sectionTitle}>
                  {stickySection.categoryTitle}
                </Text>
              </View>
              <View style={styles.sectionListButton}>
                <Ionicons name="list" size={29} color="#fff" />
              </View>
            </Pressable>
          </View>
        ) : null
      }
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
          <Image
            source={getAvatarSource(profile?.avatarId)}
            resizeMode="cover"
            style={styles.avatarImage}
          />
        </View>
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
          }}
        >
          <View style={styles.roadLine} />
          {pathDecks.map((deck, index) => {
            const sectionPalette = getSectionPalette(deck.categoryOrder);
            const unlocked = isUnlocked(deck);
            const reviewed = deckStates[deck.id]?.reviewedCardCount ?? 0;
            const lessonPercent = deck.cardCount
              ? Math.min(100, Math.round((reviewed / deck.cardCount) * 100))
              : 0;
            const completed = lessonPercent >= 80;
            const gold = Boolean(deckStates[deck.id]?.goldCompletedAt);
            const active = activeDeck?.id === deck.id;
            const previousDeck = pathDecks[index - 1];
            const showSection =
              index === 0 || deck.categoryTitle !== previousDeck?.categoryTitle;
            const checkpoint = (index + 1) % 5 === 0;
            const nodeColor = gold
              ? "#F2B735"
              : completed
                ? colors.success
                : unlocked
                  ? sectionPalette.main
                  : colors.muted;
            const nodeIcon = !unlocked
              ? "lock-closed"
              : gold
                ? "trophy"
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
                onLayout={
                  showSection
                    ? (event) => {
                        sectionOffsetsRef.current[deck.categoryOrder ?? 0] =
                          event.nativeEvent.layout.y + 16;
                      }
                    : undefined
                }
              >
                {showSection ? (
                  <View style={styles.sectionBanner}>
                    <View style={styles.sectionBannerCopy}>
                      <Text
                        style={[
                          styles.roadSectionOverline,
                          { color: sectionPalette.main },
                        ]}
                      >
                        PHẦN {deck.categoryOrder}
                      </Text>
                      <Text
                        style={[
                          styles.roadSectionTitle,
                          { color: sectionPalette.main },
                        ]}
                      >
                        {deck.categoryTitle}
                      </Text>
                    </View>
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
                    {active ? (
                      <Animated.View
                        style={[
                          styles.activeRing,
                          activeRingAnimation,
                          {
                            borderColor: `${sectionPalette.main}45`,
                            backgroundColor: `${sectionPalette.main}24`,
                          },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.nodeShadow,
                        {
                          backgroundColor: completed
                            ? gold
                              ? "#BE7D09"
                              : colors.success
                            : unlocked
                              ? sectionPalette.dark
                              : colors.border,
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
                    {gold ? (
                      <View style={styles.goldBadge}>
                        <Text style={styles.goldBadgeText}>GOLD</Text>
                      </View>
                    ) : checkpoint ? (
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
                {selectedDeckCompleted ? (
                  <Pressable
                    style={styles.goldAction}
                    onPress={() => {
                      setSelectedDeck(null);
                      router.push({
                        pathname: "/practice/[deckId]",
                        params: {
                          deckId: selectedDeck.id,
                          mode: "gold",
                        },
                      });
                    }}
                  >
                    <View style={styles.goldActionIcon}>
                      <Ionicons name="trophy" size={20} color="#8A5900" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goldActionTitle}>
                        {selectedDeckGold
                          ? "Ôn lại bài tập Gold"
                          : "Ôn tập để mở Gold"}
                      </Text>
                      <Text style={styles.goldActionHint}>
                        {selectedDeckGold
                          ? "Củng cố lại kiến thức của bài học này"
                          : "Hoàn thành bài ôn để chuyển trạng thái sang Gold"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#8A5900"
                    />
                  </Pressable>
                ) : null}
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
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={sectionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSectionPickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSectionPickerVisible(false)}
        >
          <Pressable
            style={styles.sectionPickerSheet}
            onPress={() => undefined}
          >
            <View style={styles.sectionPickerHeader}>
              <View>
                <Text style={styles.sectionPickerTitle}>Chọn phần học</Text>
                <Text style={styles.sectionPickerHint}>
                  Chuyển nhanh đến nhóm chủ đề bạn muốn học.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng danh sách phần học"
                hitSlop={8}
                onPress={() => setSectionPickerVisible(false)}
              >
                <Ionicons name="close" size={26} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sectionPickerScroll}
              contentContainerStyle={styles.sectionPickerList}
              showsVerticalScrollIndicator={false}
            >
              {pathSections.map((section) => {
                const sectionPalette = getSectionPalette(section.categoryOrder);
                const selected =
                  section.categoryOrder ===
                  (stickyCategoryOrder ?? pathSections[0]?.categoryOrder);
                return (
                  <Pressable
                    key={section.categoryOrder}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => jumpToSection(section.categoryOrder)}
                    style={({ pressed }) => [
                      styles.sectionPickerItem,
                      {
                        borderColor: selected
                          ? sectionPalette.main
                          : `${sectionPalette.main}55`,
                        backgroundColor: selected
                          ? `${sectionPalette.main}1F`
                          : colors.background,
                      },
                      pressed && styles.stopPressed,
                    ]}
                  >
                    <View style={styles.sectionBannerCopy}>
                      <Text
                        style={[
                          styles.sectionPickerItemTitle,
                          { color: sectionPalette.main },
                        ]}
                      >
                        {section.categoryTitle}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "chevron-forward"}
                      size={23}
                      color={selected ? sectionPalette.main : colors.muted}
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

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
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
    xpValue: { color: colors.primary },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
      borderWidth: 3,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      ...shadows.card,
    },
    avatarImage: { width: "100%", height: "100%" },
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
      borderColor: colors.border,
    },
    missionIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.border,
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
      borderColor: colors.border,
    },
    roadStep: { width: "100%" },
    sectionBanner: {
      zIndex: 3,
      minHeight: 64,
      justifyContent: "center",
      paddingHorizontal: 8,
      marginTop: 18,
      marginBottom: 10,
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
    sectionBannerCopy: { flex: 1 },
    roadSectionOverline: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textAlign: "center",
    },
    roadSectionTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 4,
      textAlign: "center",
    },
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
      borderColor: colors.primarySoft,
      backgroundColor: colors.primarySoft,
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
    goldBadge: {
      position: "absolute",
      top: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#E1A41D",
      backgroundColor: "#FFE7A3",
    },
    goldBadgeText: { color: "#8A5900", fontSize: 8, fontWeight: "900" },
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
    sectionPickerItemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
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
    goldAction: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#E1A41D",
      backgroundColor: "#FFF2C7",
    },
    goldActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFD86A",
    },
    goldActionTitle: { color: "#6F4800", fontSize: 14, fontWeight: "900" },
    goldActionHint: { color: "#936B1B", fontSize: 10, marginTop: 2 },
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
  });
