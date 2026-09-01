import { getAvatarSource } from "@/src/constants/avatarOptions";
import {
  resolveDeckColor,
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import type { Deck } from "@/src/types/models";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export function DeckCard({ deck, onPress }: { deck: Deck; onPress(): void }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const isCommunity = Boolean(deck.isPublic && deck.authorName);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor: isCommunity
              ? colors.primarySoft
              : resolveDeckColor(deck.color, colors.primary),
          },
        ]}
      >
        {isCommunity ? (
          <Image
            source={getAvatarSource(deck.authorAvatarId)}
            resizeMode="cover"
            style={styles.avatarImage}
          />
        ) : (
          <Ionicons name="book" size={24} color="#fff" />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {deck.title}
          </Text>
          {deck.isPublic ? (
            <Ionicons name="globe-outline" size={17} color={colors.primary} />
          ) : null}
        </View>
        {deck.authorName ? (
          <View style={styles.authorRow}>
            <Image
              source={getAvatarSource(deck.authorAvatarId)}
              resizeMode="cover"
              style={styles.smallAvatar}
            />
            <Text style={styles.authorName} numberOfLines={1}>
              Tác giả: {deck.authorName}
            </Text>
          </View>
        ) : null}
        <Text style={styles.description} numberOfLines={2}>
          {deck.description || deck.topic || "Bộ từ vựng của bạn"}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.count}>{deck.cardCount} thẻ</Text>
          <Text style={styles.language}>
            {deck.sourceLanguage} → {deck.targetLanguage}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      padding: 15,
      backgroundColor: colors.surface,
      borderRadius: 18,
      ...shadows.card,
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    smallAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    info: { flex: 1, gap: 5 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    title: { flexShrink: 1, color: colors.text, fontSize: 17, fontWeight: "800" },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    authorName: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: "700" },
    description: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    meta: { flexDirection: "row", gap: 10 },
    count: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    language: { color: colors.muted, fontSize: 12 },
  });
