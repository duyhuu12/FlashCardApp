import { colors, shadows } from '@/src/theme/colors';
import type { Deck } from '@/src/types/models';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function DeckCard({ deck, onPress }: { deck: Deck; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}>
      <View style={[styles.icon, { backgroundColor: deck.color || colors.primary }]}><Ionicons name="layers" size={24} color="#fff" /></View>
      <View style={styles.info}>
        <View style={styles.titleRow}><Text style={styles.title} numberOfLines={1}>{deck.title}</Text>{deck.isPublic ? <Ionicons name="globe-outline" size={17} color={colors.primary} /> : null}</View>
        <Text style={styles.description} numberOfLines={2}>{deck.description || deck.topic || 'Bộ từ vựng của bạn'}</Text>
        <View style={styles.meta}><Text style={styles.count}>{deck.cardCount} thẻ</Text><Text style={styles.language}>{deck.sourceLanguage} → {deck.targetLanguage}</Text></View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, backgroundColor: colors.surface, borderRadius: 18, ...shadows.card },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, title: { flexShrink: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 18 }, meta: { flexDirection: 'row', gap: 10 },
  count: { color: colors.primary, fontSize: 12, fontWeight: '800' }, language: { color: colors.muted, fontSize: 12 },
});
