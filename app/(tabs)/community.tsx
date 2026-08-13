import { AppButton } from '@/src/components/AppButton';
import { AppScreen } from '@/src/components/AppScreen';
import { DeckCard } from '@/src/components/DeckCard';
import { EmptyView, ErrorView, LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { cloneDeck, listPublicDecks } from '@/src/services/deckService';
import { colors } from '@/src/theme/colors';
import type { Deck } from '@/src/types/models';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function CommunityScreen() {
  const { user } = useAuth(); const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [copyingId, setCopyingId] = useState('');
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(''); try { setDecks(await listPublicDecks(user.uid)); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function copy(deck: Deck) {
    if (!user || copyingId) return; setCopyingId(deck.id);
    try { const id = await cloneDeck(user.uid, deck); Alert.alert('Đã sao chép bộ từ', 'Bộ từ đã được thêm vào thư viện của bạn.', [{ text: 'Xem bộ từ', onPress: () => router.push(`/deck/${id}`) }]); }
    catch (e) { Alert.alert('Không thể sao chép', friendlyError(e)); }
    finally { setCopyingId(''); }
  }

  return <AppScreen contentStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.title}>Khám phá</Text><Text style={styles.subtitle}>Tìm bộ từ công khai từ cộng đồng.</Text></View><View style={styles.icon}><Ionicons name="compass" size={27} color={colors.primary} /></View></View>
    {loading ? <LoadingView message="Đang tải bộ từ cộng đồng..." /> : error ? <ErrorView message={error} onRetry={load} /> : decks.length === 0 ? <EmptyView title="Chưa có bộ từ công khai" message="Hãy quay lại sau hoặc công khai một bộ từ của bạn." /> : <View style={styles.list}>{decks.map((deck) => <View key={deck.id} style={styles.item}><DeckCard deck={deck} onPress={() => router.push(`/deck/${deck.id}`)} /><AppButton title="Sao chép vào thư viện" variant="secondary" onPress={() => copy(deck)} loading={copyingId === deck.id} /></View>)}</View>}
  </AppScreen>;
}
const styles = StyleSheet.create({ content: { width: '100%', maxWidth: 620, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.text, fontSize: 26, fontWeight: '900' }, subtitle: { color: colors.muted, marginTop: 5 }, icon: { width: 49, height: 49, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, list: { gap: 15 }, item: { gap: 8 } });
