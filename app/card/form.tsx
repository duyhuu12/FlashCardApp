import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { AppScreen } from '@/src/components/AppScreen';
import { LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { createCard, getCard, hasDuplicateCard, updateCard } from '@/src/services/deckService';
import { useThemedStyles, type AppColors } from '@/src/theme/colors';
import { friendlyError } from '@/src/utils/errors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

export default function CardFormScreen() {
  const styles = useThemedStyles(createStyles);
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId?: string }>();
  const { user } = useAuth(); const router = useRouter();
  const [term, setTerm] = useState(''); const [meaning, setMeaning] = useState('');
  const [pronunciation, setPronunciation] = useState(''); const [example, setExample] = useState(''); const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(Boolean(cardId)); const [saving, setSaving] = useState(false); const [errors, setErrors] = useState({ term: '', meaning: '' });

  useEffect(() => { if (!cardId) return; getCard(deckId, cardId).then((card) => { if (!card) throw new Error('Không tìm thấy thẻ từ.'); setTerm(card.term); setMeaning(card.meaning); setPronunciation(card.pronunciation); setExample(card.example); setImageUrl(card.imageUrl); }).catch((error) => Alert.alert('Không thể tải thẻ', friendlyError(error))).finally(() => setLoading(false)); }, [cardId, deckId]);

  async function submit() {
    const nextErrors = { term: term.trim() ? '' : 'Hãy nhập từ vựng.', meaning: meaning.trim() ? '' : 'Hãy nhập nghĩa của từ.' };
    setErrors(nextErrors); if (nextErrors.term || nextErrors.meaning || !user || saving) return;
    setSaving(true);
    try {
      if (await hasDuplicateCard(deckId, term, cardId)) { setErrors((current) => ({ ...current, term: 'Từ này đã có trong bộ.' })); return; }
      const input = { term: term.trim(), meaning: meaning.trim(), pronunciation: pronunciation.trim(), example: example.trim(), imageUrl: imageUrl.trim() };
      if (cardId) await updateCard(deckId, cardId, input); else await createCard(user.uid, deckId, input);
      router.back();
    } catch (error) { Alert.alert('Không thể lưu thẻ', friendlyError(error)); }
    finally { setSaving(false); }
  }

  if (loading) return <AppScreen><LoadingView /></AppScreen>;
  return <AppScreen contentStyle={styles.content}><Text style={styles.title}>{cardId ? 'Sửa thẻ từ' : 'Thêm thẻ từ'}</Text><Text style={styles.subtitle}>Từ và nghĩa là hai trường bắt buộc.</Text><AppInput label="Từ vựng *" value={term} onChangeText={setTerm} error={errors.term} autoCapitalize="none" /><AppInput label="Nghĩa *" value={meaning} onChangeText={setMeaning} error={errors.meaning} /><AppInput label="Phiên âm" value={pronunciation} onChangeText={setPronunciation} /><AppInput label="Ví dụ" value={example} onChangeText={setExample} multiline /><AppInput label="URL ảnh minh họa" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" /><AppButton title={cardId ? 'Lưu thay đổi' : 'Thêm thẻ'} onPress={submit} loading={saving} /></AppScreen>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({ content: { width: '100%', maxWidth: 620, alignSelf: 'center' }, title: { color: colors.text, fontSize: 25, fontWeight: '900' }, subtitle: { color: colors.muted } });
