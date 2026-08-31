import { AppScreen } from "@/src/components/AppScreen";
import { ErrorView, LoadingView } from "@/src/components/StateView";
import { getAvatarSource } from "@/src/constants/avatarOptions";
import { useAuth } from "@/src/context/AuthContext";
import { getLearningStats, listLeaderboard } from "@/src/services/deckService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { LeaderboardEntry, LearningStats } from "@/src/types/models";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type StatsSegment = "overview" | "achievements";

const emptyStats: LearningStats = {
  totalDecks: 0,
  totalCards: 0,
  mastered: 0,
  due: 0,
  learning: 0,
  reviewedLast7Days: 0,
};

export default function StatsScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [segment, setSegment] = useState<StatsSegment>("overview");
  const [tabsPinned, setTabsPinned] = useState(false);
  const [progressSlide, setProgressSlide] = useState(0);
  const [progressCardWidth, setProgressCardWidth] = useState(0);
  const tabsTopRef = useRef(Number.POSITIVE_INFINITY);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const nextStats = await getLearningStats(user.uid);
      setStats(nextStats);
      listLeaderboard()
        .then(setLeaders)
        .catch(() => setLeaders([]));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading)
    return (
      <AppScreen>
        <LoadingView message="Đang tổng hợp tiến độ..." />
      </AppScreen>
    );
  if (error)
    return (
      <AppScreen>
        <ErrorView message={error} onRetry={load} />
      </AppScreen>
    );
  const percent = stats.totalCards
    ? Math.round((stats.mastered / stats.totalCards) * 100)
    : 0;
  const cards = [
    {
      label: "Đã thuộc",
      value: stats.mastered,
      filter: "mastered",
      icon: "checkmark-circle" as const,
      color: colors.success,
      soft: colors.successSoft,
    },
    {
      label: "Cần ôn",
      value: stats.due,
      filter: "due",
      icon: "time" as const,
      color: colors.danger,
      soft: colors.dangerSoft,
    },
    {
      label: "Đang học",
      value: stats.learning,
      filter: "learning",
      icon: "school" as const,
      color: colors.warning,
      soft: colors.warningSoft,
    },
    {
      label: "Từ mới",
      value: stats.newAvailable ?? 0,
      filter: "new",
      icon: "book" as const,
      color: colors.primary,
      soft: colors.primarySoft,
    },
  ];
  const achievements = [
    {
      title: "Bước đầu tiên",
      detail: "Hoàn thành phiên học đầu",
      unlocked: (stats.reviewedLast7Days ?? 0) > 0,
      icon: "footsteps" as const,
    },
    {
      title: "Bền bỉ 3 ngày",
      detail: "Duy trì streak 3 ngày",
      unlocked: (stats.streak ?? 0) >= 3,
      icon: "flame" as const,
    },
    {
      title: "100 XP",
      detail: "Tích lũy 100 điểm",
      unlocked: (stats.xp ?? 0) >= 100,
      icon: "star" as const,
    },
    {
      title: "Bậc thầy 50 từ",
      detail: "Thuộc ít nhất 50 từ",
      unlocked: stats.mastered >= 50,
      icon: "ribbon" as const,
    },
  ];
  const todayGoal = Math.max(1, stats.dailyGoal ?? 30);
  const reviewedToday = stats.reviewedToday ?? 0;
  const dailyPercent = Math.min(
    100,
    Math.round((reviewedToday / todayGoal) * 100),
  );
  const unlockedCount = achievements.filter((item) => item.unlocked).length;

  const renderStatsTabs = (pinned = false) => (
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
          ["overview", "stats-chart", "Tổng quan"],
          ["achievements", "trophy", "Thành tích"],
        ] as const
      ).map(([id, icon, label]) => {
        const selected = segment === id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={id}
            onPress={() => setSegment(id)}
            style={({ pressed }) => [
              styles.segmentButton,
              selected && styles.segmentButtonSelected,
              pressed && styles.segmentButtonPressed,
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
            {renderStatsTabs(true)}
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
        <View>
          <Text style={styles.title}>Tiến độ học tập</Text>
          <Text style={styles.subtitle}>Mỗi ngày tiến thêm một chút</Text>
        </View>
      </View>

      {renderStatsTabs()}

      {segment === "overview" ? (
        <>
          <View
            onLayout={(event) =>
              setProgressCardWidth(event.nativeEvent.layout.width)
            }
            style={styles.progressCarousel}
          >
            <ScrollView
              decelerationRate="fast"
              horizontal
              onMomentumScrollEnd={(event) => {
                if (!progressCardWidth) return;
                setProgressSlide(
                  Math.round(
                    event.nativeEvent.contentOffset.x / progressCardWidth,
                  ),
                );
              }}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              <View style={[styles.progressPage, { width: progressCardWidth }]}>
          <View style={styles.hero}>
            <View style={styles.circle}>
              <Text style={styles.percent}>{percent}%</Text>
              <Text style={styles.small}>ĐÃ THUỘC</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>TỔNG TIẾN ĐỘ</Text>
              <Text style={styles.heroTitle}>
                {stats.mastered.toLocaleString("vi-VN")} từ đã ghi nhớ
              </Text>
              <Text style={styles.heroText}>
                Trong tổng số {stats.totalCards.toLocaleString("vi-VN")} từ của
                bạn
              </Text>
            </View>
          </View>
              </View>

              <View style={[styles.progressPage, { width: progressCardWidth }]}>
          <View style={styles.dailyCard}>
            <View style={styles.dailyTop}>
              <View style={styles.dailyIcon}>
                <Ionicons name="flag" size={23} color={colors.primary} />
              </View>
              <View style={styles.dailyCopy}>
                <Text style={styles.dailyLabel}>MỤC TIÊU HÔM NAY</Text>
                <Text style={styles.dailyValue}>
                  {reviewedToday}/{todayGoal} thẻ
                </Text>
              </View>
              <Text style={styles.dailyPercent}>{dailyPercent}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${dailyPercent}%` }]} />
            </View>
            <View style={styles.quickStats}>
              <View style={styles.quickStat}>
                <Ionicons name="flame" size={20} color={colors.warning} />
                <Text style={styles.quickValue}>{stats.streak ?? 0}</Text>
                <Text style={styles.quickLabel}>ngày streak</Text>
              </View>
              <View style={styles.quickDivider} />
              <View style={styles.quickStat}>
                <Ionicons name="diamond" size={19} color={colors.primary} />
                <Text style={styles.quickValue}>{stats.xp ?? 0}</Text>
                <Text style={styles.quickLabel}>KN tích lũy</Text>
              </View>
            </View>
          </View>
              </View>
            </ScrollView>
            <View style={styles.carouselDots}>
              {[0, 1].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.carouselDot,
                    progressSlide === index && styles.carouselDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Từ vựng của bạn</Text>
            <Text style={styles.sectionMeta}>
              {stats.totalCards.toLocaleString("vi-VN")} từ
            </Text>
          </View>
          <View style={styles.grid}>
            {cards.map((card) => (
              <Pressable
                accessibilityRole="button"
                accessibilityHint={`Mở danh sách ${card.label.toLocaleLowerCase("vi-VN")}`}
                key={card.label}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/vocabulary",
                    params: { filter: card.filter },
                  })
                }
                style={({ pressed }) => [
                  styles.stat,
                  pressed && styles.statPressed,
                ]}
              >
                <View style={[styles.statIcon, { backgroundColor: card.soft }]}>
                  <Ionicons name={card.icon} size={23} color={card.color} />
                </View>
                <View style={styles.statCopy}>
                  <Text style={styles.statValue}>
                    {card.value.toLocaleString("vi-VN")}
                  </Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.muted}
                />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.achievementHero}>
            <View style={styles.trophyCircle}>
              <Ionicons name="trophy" size={34} color={colors.warning} />
            </View>
            <View style={styles.achievementHeroCopy}>
              <Text style={styles.achievementHeroTitle}>
                {unlockedCount}/{achievements.length} huy hiệu
              </Text>
              <Text style={styles.achievementHeroText}>
                Tiếp tục học để mở khóa tất cả thành tích.
              </Text>
              <View style={styles.achievementTrack}>
                <View
                  style={[
                    styles.achievementFill,
                    {
                      width: `${(unlockedCount / achievements.length) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Huy hiệu của bạn</Text>
          <View style={styles.achievementList}>
            {achievements.map((item) => (
              <View
                key={item.title}
                style={[styles.achievement, !item.unlocked && styles.locked]}
              >
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: item.unlocked
                        ? colors.warningSoft
                        : colors.background,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.unlocked ? item.icon : "lock-closed"}
                    size={24}
                    color={item.unlocked ? colors.warning : colors.muted}
                  />
                </View>
                <View style={styles.achievementCopy}>
                  <Text style={styles.achievementTitle}>{item.title}</Text>
                  <Text style={styles.achievementDetail}>{item.detail}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    item.unlocked && styles.statusBadgeUnlocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.unlocked && styles.statusTextUnlocked,
                    ]}
                  >
                    {item.unlocked ? "Đã đạt" : "Chưa đạt"}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Bảng xếp hạng KN</Text>
            <Ionicons name="podium" size={23} color={colors.primary} />
          </View>
          {leaders.length === 0 ? (
            <View style={styles.info}>
              <Ionicons
                name="information-circle"
                size={22}
                color={colors.primary}
              />
              <Text style={styles.infoText}>
                Triển khai Firestore Rules mới để kích hoạt bảng xếp hạng.
              </Text>
            </View>
          ) : (
            <View style={styles.leaderboard}>
              {leaders.map((entry, index) => (
                <View
                  key={entry.uid}
                  style={[styles.leader, entry.uid === user?.uid && styles.me]}
                >
                  <View
                    style={[
                      styles.rankBadge,
                      index < 3 &&
                        [styles.rank1, styles.rank2, styles.rank3][index],
                    ]}
                  >
                    <Text style={styles.rank}>{index + 1}</Text>
                  </View>
                  <View style={styles.avatar}>
                    <Image
                      source={getAvatarSource(entry.avatarId)}
                      resizeMode="cover"
                      style={styles.avatarImage}
                    />
                  </View>
                  <Text style={styles.leaderName}>
                    {entry.uid === user?.uid ? "Bạn" : entry.displayName}
                  </Text>
                  <Text style={styles.leaderXp}>{entry.xp} KN</Text>
                </View>
              ))}
            </View>
          )}
        </>
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
      paddingBottom: 36,
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
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.78)", marginTop: 4 },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
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
    segmentButtonPressed: { opacity: 0.72 },
    segmentText: { color: colors.muted, fontSize: 14, fontWeight: "900" },
    segmentTextSelected: { color: colors.primary },
    progressCarousel: { width: "auto", marginHorizontal: -20, gap: 9 },
    progressPage: { paddingVertical: 2 },
    carouselDots: {
      minHeight: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    carouselDot: {
      width: 7,
      height: 7,
      borderRadius: 99,
      backgroundColor: colors.border,
    },
    carouselDotActive: { width: 20, backgroundColor: colors.primary },
    hero: {
      minHeight: 150,
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    circle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 9,
      borderColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    percent: { color: colors.primary, fontSize: 26, fontWeight: "900" },
    small: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: "900",
      marginTop: 2,
    },
    heroCopy: { flex: 1 },
    heroEyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },
    heroTitle: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 5 },
    heroText: { color: colors.muted, marginTop: 6, lineHeight: 18 },
    dailyCard: {
      paddingHorizontal: 20,
      paddingVertical: 17,
    },
    dailyTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    dailyIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    dailyCopy: { flex: 1 },
    dailyLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    dailyValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 3,
    },
    dailyPercent: { color: colors.primary, fontSize: 18, fontWeight: "900" },
    track: {
      height: 9,
      overflow: "hidden",
      marginTop: 14,
      borderRadius: 10,
      backgroundColor: colors.border,
    },
    fill: { height: "100%", borderRadius: 10, backgroundColor: colors.primary },
    quickStats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    quickStat: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    quickDivider: { width: 1, height: 25, backgroundColor: colors.border },
    quickValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
    quickLabel: { color: colors.muted, fontSize: 11 },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 3,
    },
    sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
    sectionMeta: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stat: {
      width: "48%",
      minHeight: 82,
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    statPressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
    statIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    statCopy: { flex: 1 },
    statValue: { color: colors.text, fontSize: 21, fontWeight: "900" },
    statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
    achievementHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      borderRadius: 22,
      backgroundColor: colors.warningSoft,
    },
    trophyCircle: {
      width: 64,
      height: 64,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    achievementHeroCopy: { flex: 1 },
    achievementHeroTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900",
    },
    achievementHeroText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    achievementTrack: {
      height: 7,
      overflow: "hidden",
      marginTop: 10,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    achievementFill: {
      height: "100%",
      borderRadius: 8,
      backgroundColor: colors.warning,
    },
    achievementList: { gap: 9 },
    achievement: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    locked: { opacity: 0.66 },
    badge: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    achievementCopy: { flex: 1 },
    achievementTitle: { color: colors.text, fontWeight: "900" },
    achievementDetail: { color: colors.muted, fontSize: 12, marginTop: 3 },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor: colors.background,
    },
    statusBadgeUnlocked: { backgroundColor: colors.successSoft },
    statusText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    statusTextUnlocked: { color: colors.success },
    leaderboard: {
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 19,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    leader: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    me: { backgroundColor: colors.primarySoft },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    rank1: { backgroundColor: "#FFD765" },
    rank2: { backgroundColor: "#D9E1E5" },
    rank3: { backgroundColor: "#EAB27A" },
    rank: { color: colors.text, fontSize: 12, fontWeight: "900" },
    avatar: {
      width: 37,
      height: 37,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    leaderName: { flex: 1, color: colors.text, fontWeight: "800" },
    leaderXp: { color: colors.warning, fontWeight: "900" },
    info: {
      flexDirection: "row",
      gap: 9,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    infoText: { flex: 1, color: colors.text, lineHeight: 19 },
  });
