import { AppScreen } from "@/src/components/AppScreen";
import { ErrorView, LoadingView } from "@/src/components/StateView";
import { getAvatarSource } from "@/src/constants/avatarOptions";
import { useAuth } from "@/src/context/AuthContext";
import {
  getLearningStats,
  listLeaderboard,
  listProgress,
} from "@/src/services/deckService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { CardProgress, LeaderboardEntry, LearningStats } from "@/src/types/models";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
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
  const [progressItems, setProgressItems] = useState<CardProgress[]>([]);
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
      const [nextStats, progress] = await Promise.all([
        getLearningStats(user.uid),
        listProgress(user.uid),
      ]);
      setStats(nextStats);
      setProgressItems(progress);
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

  // 1. Biểu đồ 7 Ngày qua (7-Day Activity Bar Chart)
  const weeklyActivity = useMemo(() => {
    const days: { label: string; dateStr: string; count: number; isToday: boolean }[] = [];
    const now = new Date();
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = dayNames[d.getDay()];
      const isToday = i === 0;

      const count = progressItems.filter((p) => {
        if (!p.lastReviewedAt) return false;
        const pDate = p.lastReviewedAt instanceof Date
          ? p.lastReviewedAt
          : (p.lastReviewedAt as any).toDate
            ? (p.lastReviewedAt as any).toDate()
            : new Date(p.lastReviewedAt);
        return pDate.toISOString().split("T")[0] === dateStr;
      }).length;

      days.push({ label, dateStr, count, isToday });
    }

    const maxCount = Math.max(1, ...days.map((d) => d.count));
    return { days, maxCount };
  }, [progressItems]);

  // 2. Biểu đồ Cấp độ Trí nhớ (Memory Retention Stages)
  const retentionStages = useMemo(() => {
    let stage1 = 0; // Mới gặp
    let stage2 = 0; // Đang củng cố
    let stage3 = 0; // Sắp thuộc
    let stage4 = 0; // Đã thuộc dài hạn

    progressItems.forEach((p) => {
      if (!p.lastReviewedAt) return;
      if (p.mastered || (p.consecutiveCorrect >= 3 && p.intervalMinutes >= 7 * 24 * 60)) {
        stage4 += 1;
      } else if (p.consecutiveCorrect >= 2) {
        stage3 += 1;
      } else if (p.consecutiveCorrect >= 1) {
        stage2 += 1;
      } else {
        stage1 += 1;
      }
    });

    const totalReviewed = Math.max(1, stage1 + stage2 + stage3 + stage4);

    return [
      {
        id: "stage1",
        name: "Mới gặp",
        detail: "Trí nhớ ngắn hạn (10-30 phút)",
        count: stage1,
        percent: Math.round((stage1 / totalReviewed) * 100),
        color: "#FFB020",
        soft: "#FFF7E6",
      },
      {
        id: "stage2",
        name: "Đang củng cố",
        detail: "Ôn lại 1-2 lần (1-3 ngày)",
        count: stage2,
        percent: Math.round((stage2 / totalReviewed) * 100),
        color: "#1CB0F6",
        soft: "#EAF7FF",
      },
      {
        id: "stage3",
        name: "Sắp thuộc",
        detail: "Khắc sâu ghi nhớ (3-7 ngày)",
        count: stage3,
        percent: Math.round((stage3 / totalReviewed) * 100),
        color: "#A05EB5",
        soft: "#F6ECFC",
      },
      {
        id: "stage4",
        name: "Đã thuộc dài hạn",
        detail: "Ghi nhớ bền vững (≥ 7 ngày)",
        count: stage4,
        percent: Math.round((stage4 / totalReviewed) * 100),
        color: "#20BF6B",
        soft: "#E8F8F0",
      },
    ];
  }, [progressItems]);

  // 3. Thời gian & Tốc độ Học (Study Time & Speed Metrics)
  const studySpeedMetrics = useMemo(() => {
    const totalReps = progressItems.reduce((acc, p) => acc + (p.repetitions || 0), 0);
    const totalSeconds = totalReps * 35;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds % 3600) / 60);
    const timeText = hours > 0 ? `${hours}h ${mins}p` : `${mins} phút`;

    const streakDays = Math.max(1, stats.streak || 1);
    const dailyAvg = Math.max(1, Math.round(progressItems.length / streakDays));
    const remaining = Math.max(0, (stats.totalCards || 3000) - stats.mastered);
    const daysLeft = Math.ceil(remaining / dailyAvg);

    return { timeText, dailyAvg, daysLeft };
  }, [progressItems, stats]);

  // 4. Dự báo Lịch ôn 7 Ngày tới (7-Day Upcoming Review Forecast)
  const reviewForecast = useMemo(() => {
    const forecast: { label: string; dateStr: string; count: number; isToday: boolean }[] = [];
    const now = new Date();
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const label = i === 0 ? "Hôm nay" : i === 1 ? "Ngày mai" : dayNames[d.getDay()];

      const count = progressItems.filter((p) => {
        if (!p.nextReviewAt) return false;
        const nDate = p.nextReviewAt instanceof Date
          ? p.nextReviewAt
          : (p.nextReviewAt as any).toDate
            ? (p.nextReviewAt as any).toDate()
            : new Date(p.nextReviewAt);
        return nDate.toISOString().split("T")[0] === dateStr;
      }).length;

      forecast.push({ label, dateStr, count, isToday: i === 0 });
    }

    return forecast;
  }, [progressItems]);

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
          {/* Slide Progress & Daily Goal */}
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
                      Trong tổng số {stats.totalCards.toLocaleString("vi-VN")} từ của bạn
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

          {/* Quick Stats Grid */}
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

          {/* FEATURE 1: 7-Day Study Bar Chart */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <View style={[styles.featureIconWrapper, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="bar-chart" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureCardTitle}>Hoạt động 7 ngày qua</Text>
                <Text style={styles.featureCardHint}>Số lượt từ vựng bạn đã ôn/học mỗi ngày</Text>
              </View>
            </View>
            <View style={styles.barChartRow}>
              {weeklyActivity.days.map((day) => {
                const heightPercent = Math.max(12, Math.round((day.count / weeklyActivity.maxCount) * 100));
                return (
                  <View key={day.dateStr} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{day.count > 0 ? day.count : ""}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: day.isToday
                              ? colors.primary
                              : day.count > 0
                                ? colors.primaryDark
                                : colors.border,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        day.isToday && { color: colors.primary, fontWeight: "900" },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* FEATURE 2: Memory Retention Stages */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <View style={[styles.featureIconWrapper, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="git-network" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureCardTitle}>Phân bổ cấp độ trí nhớ</Text>
                <Text style={styles.featureCardHint}>Dịch chuyển từ vựng từ ngắn hạn sang dài hạn</Text>
              </View>
            </View>

            {/* Retention Funnel Multi-segment bar */}
            <View style={styles.funnelBar}>
              {retentionStages.map((stage) =>
                stage.percent > 0 ? (
                  <View
                    key={stage.id}
                    style={{
                      height: "100%",
                      width: `${stage.percent}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                ) : null,
              )}
            </View>

            {/* Stage Items */}
            <View style={{ gap: 8, marginTop: 12 }}>
              {retentionStages.map((stage) => (
                <View key={stage.id} style={styles.stageRow}>
                  <View style={[styles.stageBadgeDot, { backgroundColor: stage.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stageName}>{stage.name}</Text>
                    <Text style={styles.stageDetail}>{stage.detail}</Text>
                  </View>
                  <Text style={styles.stageCountText}>{stage.count} từ</Text>
                  <Text style={[styles.stagePercentText, { color: stage.color }]}>
                    {stage.percent}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* FEATURE 3: Study Time & Speed Metrics */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <View style={[styles.featureIconWrapper, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="speedometer" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureCardTitle}>Thời gian & Tốc độ làm chủ</Text>
                <Text style={styles.featureCardHint}>Hiệu suất tích lũy từ khi bắt đầu học</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Ionicons name="time" size={22} color={colors.primary} />
                <Text style={styles.metricValue}>{studySpeedMetrics.timeText}</Text>
                <Text style={styles.metricLabel}>Đã tích lũy học</Text>
              </View>
              <View style={styles.metricBox}>
                <Ionicons name="flash" size={22} color={colors.warning} />
                <Text style={styles.metricValue}>{studySpeedMetrics.dailyAvg} từ</Text>
                <Text style={styles.metricLabel}>Tốc độ / ngày</Text>
              </View>
              <View style={styles.metricBox}>
                <Ionicons name="flag" size={22} color={colors.success} />
                <Text style={styles.metricValue}>~{studySpeedMetrics.daysLeft} ngày</Text>
                <Text style={styles.metricLabel}>Dự kiến cán đích</Text>
              </View>
            </View>
          </View>

          {/* FEATURE 4: 7-Day Upcoming Review Forecast */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <View style={[styles.featureIconWrapper, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureCardTitle}>Dự báo lịch ôn 7 ngày tới</Text>
                <Text style={styles.featureCardHint}>Số từ tự động nhắc ôn theo thuật toán lặp lại ngắt quãng</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forecastScroll}
            >
              {reviewForecast.map((item) => (
                <View
                  key={item.dateStr}
                  style={[
                    styles.forecastItem,
                    item.isToday && styles.forecastItemToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.forecastLabel,
                      item.isToday && { color: colors.primary, fontWeight: "900" },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <View
                    style={[
                      styles.forecastBadge,
                      {
                        backgroundColor:
                          item.count > 0
                            ? item.isToday
                              ? colors.primary
                              : colors.primarySoft
                            : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.forecastCountText,
                        {
                          color:
                            item.count > 0
                              ? item.isToday
                                ? "#FFFFFF"
                                : colors.primary
                              : colors.muted,
                        },
                      ]}
                    >
                      {item.count} từ
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
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
      marginTop: 14,
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

    // Feature Card Styling
    featureCard: {
      padding: 18,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: 14,
      gap: 14,
      ...shadows.card,
    },
    featureCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    featureIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    featureCardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    featureCardHint: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },

    // 1. Bar Chart Styles
    barChartRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 140,
      paddingTop: 10,
      paddingHorizontal: 4,
    },
    barColumn: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      justifyContent: "flex-end",
      gap: 6,
    },
    barValueText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
    },
    barTrack: {
      width: 14,
      height: 90,
      borderRadius: 7,
      backgroundColor: colors.background,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    barFill: {
      width: "100%",
      borderRadius: 7,
    },
    barLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
    },

    // 2. Retention Funnel Styles
    funnelBar: {
      height: 10,
      borderRadius: 99,
      flexDirection: "row",
      overflow: "hidden",
      backgroundColor: colors.border,
    },
    stageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 4,
    },
    stageBadgeDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    stageName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    stageDetail: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 1,
    },
    stageCountText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    stagePercentText: {
      fontSize: 14,
      fontWeight: "900",
      minWidth: 40,
      textAlign: "right",
    },

    // 3. Metrics Grid Styles
    metricsGrid: {
      flexDirection: "row",
      gap: 10,
    },
    metricBox: {
      flex: 1,
      padding: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      gap: 4,
    },
    metricValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 2,
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 10,
      textAlign: "center",
    },

    // 4. Forecast Scroll Styles
    forecastScroll: {
      gap: 9,
      paddingVertical: 2,
    },
    forecastItem: {
      width: 72,
      paddingVertical: 11,
      paddingHorizontal: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      gap: 8,
    },
    forecastItemToday: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    forecastLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
    },
    forecastBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    forecastCountText: {
      fontSize: 11,
      fontWeight: "900",
    },

    // Achievements Section Styles
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
