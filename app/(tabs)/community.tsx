import { AppScreen } from "@/src/components/AppScreen";
import { DeckCard } from "@/src/components/DeckCard";
import { EmptyView, ErrorView, LoadingView } from "@/src/components/StateView";
import { useAuth } from "@/src/context/AuthContext";
import { BUILT_IN_PATH_ID } from "@/src/services/builtInVocabularyService";
import {
  listOwnedDecks,
  listOwnedDecksFromCache,
  listPublicDecks,
} from "@/src/services/deckService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { Deck } from "@/src/types/models";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ExploreSection = "mine" | "community";
type SortMode = "newest" | "most_cards";

function personalOnly(decks: Deck[]) {
  return decks.filter((deck) => deck.pathId !== BUILT_IN_PATH_ID);
}

export default function CommunityScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<ExploreSection>("mine");
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [communityDecks, setCommunityDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tabsPinned, setTabsPinned] = useState(false);
  const tabsTopRef = useRef(Number.POSITIVE_INFINITY);

  // Search & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sortOptions: { id: SortMode; label: string; icon: "time" | "library" }[] = [
    { id: "newest", label: "Mới nhất", icon: "time" },
    { id: "most_cards", label: "Nhiều thẻ nhất", icon: "library" },
  ];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const cachedOwned = await listOwnedDecksFromCache(user.uid);
      setMyDecks(personalOnly(cachedOwned));
      const [owned, publicDecks] = await Promise.all([
        listOwnedDecks(user.uid),
        listPublicDecks(user.uid),
      ]);
      setMyDecks(personalOnly(owned));
      setCommunityDecks(publicDecks);
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

  // Filtered + sorted community decks
  const filteredCommunityDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? communityDecks.filter(
          (deck) =>
            deck.title.toLowerCase().includes(q) ||
            deck.description?.toLowerCase().includes(q) ||
            deck.topic?.toLowerCase().includes(q),
        )
      : [...communityDecks];

    if (sortMode === "newest") {
      result.sort((a, b) => {
        const aTime = a.createdAt
          ? typeof (a.createdAt as any).toMillis === "function"
            ? (a.createdAt as any).toMillis()
            : new Date(a.createdAt as any).getTime()
          : 0;
        const bTime = b.createdAt
          ? typeof (b.createdAt as any).toMillis === "function"
            ? (b.createdAt as any).toMillis()
            : new Date(b.createdAt as any).getTime()
          : 0;
        return bTime - aTime;
      });
    } else if (sortMode === "most_cards") {
      result.sort((a, b) => (b.cardCount ?? 0) - (a.cardCount ?? 0));
    }

    return result;
  }, [communityDecks, searchQuery, sortMode]);

  const renderTabs = (pinned = false) => (
    <View
      accessibilityRole="tablist"
      onLayout={
        pinned
          ? undefined
          : (event) => {
              tabsTopRef.current = event.nativeEvent.layout.y;
            }
      }
      style={[styles.tabList, pinned && styles.tabListPinned]}
    >
      {(
        [
          ["mine", "albums", "Bộ từ của tôi"],
          ["community", "people", "Bộ từ cộng đồng"],
        ] as const
      ).map(([id, icon, label]) => {
        const selected = section === id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={id}
            onPress={() => setSection(id)}
            style={({ pressed }) => [
              styles.tabButton,
              selected && styles.tabButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={icon}
              size={20}
              color={selected ? colors.primary : colors.muted}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabText, selected && styles.tabTextSelected]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const visibleDecks = section === "mine" ? myDecks : communityDecks;

  return (
    <AppScreen
      contentStyle={styles.content}
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
            {renderTabs(true)}
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
          <Text style={styles.title}>Khám phá</Text>
          <Text style={styles.subtitle}>
            Quản lý bộ từ của bạn và khám phá bộ từ cộng đồng.
          </Text>
        </View>
      </View>

      {renderTabs()}

      {loading && visibleDecks.length === 0 ? (
        <LoadingView
          message={
            section === "mine"
              ? "Đang tải bộ từ của bạn..."
              : "Đang tải bộ từ cộng đồng..."
          }
        />
      ) : error && visibleDecks.length === 0 ? (
        <ErrorView message={error} onRetry={load} />
      ) : section === "mine" ? (
        myDecks.length === 0 ? (
          <EmptyView
            title="Bạn chưa có bộ từ riêng"
            message="Tạo một bộ mới hoặc sao chép bộ từ phù hợp từ cộng đồng."
            actionTitle="Tạo bộ từ"
            onAction={() => router.push("/deck/form")}
          />
        ) : (
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>Bộ từ của tôi</Text>
                <Text style={styles.sectionHint}>{myDecks.length} bộ từ</Text>
              </View>
              <Pressable
                accessibilityLabel="Tạo bộ từ mới"
                accessibilityRole="button"
                onPress={() => router.push("/deck/form")}
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="add" size={23} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.list}>
              {myDecks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                />
              ))}
            </View>
          </View>
        )
      ) : communityDecks.length === 0 ? (
        <EmptyView
          title="Chưa có bộ từ công khai"
          message="Hãy quay lại sau hoặc công khai một bộ từ của bạn."
        />
      ) : (
        <View style={styles.sectionContent}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Bộ từ cộng đồng</Text>
              <Text style={styles.sectionHint}>
                {filteredCommunityDecks.length}/{communityDecks.length} bộ từ
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={19} color={colors.muted} />
            <TextInput
              accessibilityLabel="Tìm kiếm bộ từ cộng đồng"
              placeholder="Tìm kiếm tên, chủ đề..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <Pressable hitSlop={8} onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Sort Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: sortMenuOpen }}
            onPress={() => setSortMenuOpen((v) => !v)}
            style={styles.sortSelect}
          >
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
            <Text style={styles.sortSelectText}>Sắp xếp</Text>
            <Text style={styles.sortValue}>
              {sortOptions.find((o) => o.id === sortMode)?.label}
            </Text>
            <Ionicons
              name={sortMenuOpen ? "chevron-up" : "chevron-down"}
              size={17}
              color={colors.muted}
            />
          </Pressable>

          {sortMenuOpen ? (
            <View style={styles.sortMenu}>
              {sortOptions.map((option) => {
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
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.sortOptionText}>{option.label}</Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Results */}
          {filteredCommunityDecks.length === 0 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search-outline" size={38} color={colors.muted} />
              <Text style={styles.emptySearchTitle}>
                Không tìm thấy bộ từ nào
              </Text>
              <Text style={styles.emptySearchHint}>
                Thử nhập từ khóa khác hoặc xóa nội dung tìm kiếm.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filteredCommunityDecks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    content: {
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
    tabList: {
      minHeight: 58,
      flexDirection: "row",
      marginHorizontal: -20,
      marginTop: -16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabListPinned: {
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
    tabButton: {
      minHeight: 58,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    tabButtonSelected: { borderBottomColor: colors.primary },
    tabText: {
      flexShrink: 1,
      color: colors.muted,
      fontSize: 13,
      fontWeight: "900",
    },
    tabTextSelected: { color: colors.primary },
    sectionContent: { gap: 13 },
    sectionHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionHeadingCopy: { flex: 1 },
    sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
    sectionHint: { color: colors.muted, marginTop: 3, lineHeight: 19 },
    createButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      ...shadows.card,
    },
    list: { gap: 15 },
    pressed: { opacity: 0.72 },

    // Search Bar
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 0,
    },

    // Sort
    sortSelect: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    sortSelectText: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 13,
    },
    sortValue: {
      flex: 1,
      color: colors.text,
      fontWeight: "900",
      fontSize: 13,
    },
    sortMenu: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    sortOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sortOptionSelected: { backgroundColor: colors.primarySoft },
    sortOptionText: { flex: 1, color: colors.text, fontWeight: "800" },

    // Empty Search State
    emptySearch: {
      paddingVertical: 40,
      alignItems: "center",
      gap: 8,
    },
    emptySearchTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    emptySearchHint: {
      color: colors.muted,
      fontSize: 13,
      textAlign: "center",
    },
  });
