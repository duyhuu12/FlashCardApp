import { AppScreen } from "@/src/components/AppScreen";
import { useAuth } from "@/src/context/AuthContext";
import {
  BUILT_IN_WORD_COUNT,
  searchBuiltInVocabulary,
} from "@/src/services/builtInVocabularyService";
import { speakEnglish, stopSpeaking } from "@/src/services/speechService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RESULT_PAGE_SIZE = 40;

export default function VocabularySearchScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [visibleLimit, setVisibleLimit] = useState(RESULT_PAGE_SIZE);
  const normalizedQuery = deferredQuery.trim();
  const searchPending = query !== deferredQuery;

  const results = useMemo(
    () =>
      user && normalizedQuery
        ? searchBuiltInVocabulary(user.uid, normalizedQuery)
        : [],
    [normalizedQuery, user],
  );
  const visibleResults = results.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(RESULT_PAGE_SIZE);
  }, [normalizedQuery]);

  useEffect(
    () => () => {
      stopSpeaking().catch(() => undefined);
    },
    [],
  );

  return (
    <AppScreen
      contentStyle={styles.screen}
      safeAreaEdges={["left", "right"]}
      scrollProps={{ keyboardShouldPersistTaps: "handled" }}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Tìm kiếm từ vựng</Text>
          <Text style={styles.subtitle}>
            {BUILT_IN_WORD_COUNT.toLocaleString("vi-VN")} từ Anh → Việt
          </Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={22} color={colors.primary} />
        <TextInput
          accessibilityLabel="Nhập từ tiếng Anh hoặc nghĩa tiếng Việt"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={setQuery}
          placeholder="Nhập từ tiếng Anh hoặc nghĩa tiếng Việt"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {searchPending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : query ? (
          <Pressable
            accessibilityLabel="Xóa nội dung tìm kiếm"
            accessibilityRole="button"
            hitSlop={9}
            onPress={() => setQuery("")}
          >
            <Ionicons name="close-circle" size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {!normalizedQuery ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search" size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Bạn muốn tìm từ nào?</Text>
          <Text style={styles.emptyText}>
            Có thể tìm bằng từ tiếng Anh, nghĩa tiếng Việt hoặc nội dung ví dụ.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Không tìm thấy kết quả</Text>
          <Text style={styles.emptyText}>
            Hãy kiểm tra chính tả hoặc thử tìm bằng một từ ngắn hơn.
          </Text>
        </View>
      ) : (
        <View style={styles.resultsCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Kết quả</Text>
            <Text style={styles.resultCount}>
              {results.length.toLocaleString("vi-VN")} từ
            </Text>
          </View>
          {visibleResults.map(({ card, deck, categoryTitle, topicTitle }) => (
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
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.resultCopy}>
                <View style={styles.termLine}>
                  <Text numberOfLines={1} style={styles.term}>
                    {card.term}
                  </Text>
                  {card.pronunciation ? (
                    <Text numberOfLines={1} style={styles.pronunciation}>
                      /{card.pronunciation}/
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.meaning}>{card.meaning}</Text>
                <Text numberOfLines={1} style={styles.topic}>
                  {categoryTitle} · {topicTitle}
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
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="volume-high" size={20} color={colors.primary} />
              </Pressable>
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Pressable>
          ))}
          {results.length > visibleLimit ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setVisibleLimit((current) =>
                  Math.min(current + RESULT_PAGE_SIZE, results.length),
                )
              }
              style={({ pressed }) => [
                styles.loadMoreButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.loadMoreText}>Xem thêm kết quả</Text>
              <Ionicons name="chevron-down" size={18} color={colors.primary} />
            </Pressable>
          ) : null}
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
      paddingBottom: 36,
    },
    header: {
      minHeight: 94,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: -20,
      marginTop: -20,
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      backgroundColor: colors.primarySoft,
    },
    headerCopy: { flex: 1 },
    title: { color: colors.text, fontSize: 21, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
    searchBox: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 15,
      borderWidth: 1.5,
      borderColor: colors.primarySoft,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    searchInput: { flex: 1, minHeight: 52, color: colors.text, fontSize: 15 },
    emptyState: {
      minHeight: 280,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    emptyIcon: {
      width: 66,
      height: 66,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
      marginBottom: 14,
      backgroundColor: colors.primarySoft,
    },
    emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
    emptyText: {
      maxWidth: 330,
      color: colors.muted,
      lineHeight: 20,
      marginTop: 7,
      textAlign: "center",
    },
    resultsCard: {
      padding: 17,
      borderRadius: 21,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 5,
    },
    resultTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
    resultCount: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    resultRow: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    resultCopy: { flex: 1, gap: 3 },
    termLine: { flexDirection: "row", alignItems: "baseline", gap: 7 },
    term: { maxWidth: "62%", color: colors.text, fontSize: 17, fontWeight: "900" },
    pronunciation: { flex: 1, color: colors.muted, fontSize: 12 },
    meaning: { color: colors.text, lineHeight: 19 },
    topic: { color: colors.muted, fontSize: 11 },
    speakerButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: colors.primarySoft,
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
    pressed: { opacity: 0.65 },
  });
