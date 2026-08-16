import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { AppScreen } from '@/src/components/AppScreen';
import { LoadingView } from '@/src/components/StateView';
import { useAuth } from '@/src/context/AuthContext';
import { createDeck, getDeck, updateDeck } from '@/src/services/deckService';
import { resolveDeckColor, useAppTheme, useThemedStyles, type AppColors } from '@/src/theme/colors';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const palette = ['#087A9B', '#EF6C78', '#F2A33A', '#2EA98C', '#3B82F6'];

export default function DeckFormScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('Tiếng Anh');
  const [targetLanguage, setTargetLanguage] = useState('Tiếng Việt');
  const [color, setColor] = useState(palette[0]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    if (!id) return;
    getDeck(id).then((deck) => {
      if (!deck || deck.ownerId !== user?.uid || deck.pathId) throw new Error('Không thể sửa bộ từ này.');
      setTitle(deck.title); setDescription(deck.description); setTopic(deck.topic);
      setSourceLanguage(deck.sourceLanguage); setTargetLanguage(deck.targetLanguage);
      setColor(resolveDeckColor(deck.color)); setIsPublic(deck.isPublic);
    }).catch((error) => Alert.alert('Không thể tải bộ từ', friendlyError(error))).finally(() => setLoading(false));
  }, [id, user]);

  async function submit() {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 2) { setTitleError('Tên bộ từ cần ít nhất 2 ký tự.'); return; }
    if (!sourceLanguage.trim() || !targetLanguage.trim()) { Alert.alert('Thiếu ngôn ngữ', 'Hãy nhập ngôn ngữ nguồn và ngôn ngữ đích.'); return; }
    if (!user || saving) return;
    setTitleError(''); setSaving(true);
    try {
      const input = { title: normalizedTitle, description: description.trim(), topic: topic.trim(), sourceLanguage: sourceLanguage.trim(), targetLanguage: targetLanguage.trim(), color, isPublic };
      if (id) { await updateDeck(id, input); router.back(); }
      else { const deckId = await createDeck(user.uid, input); router.replace(`/deck/${deckId}`); }
    } catch (error) { Alert.alert('Không thể lưu bộ từ', friendlyError(error)); }
    finally { setSaving(false); }
  }

  if (loading) return <AppScreen><LoadingView /></AppScreen>;
  return <AppScreen contentStyle={styles.content}>
    <Text style={styles.title}>{id ? 'Sửa bộ từ' : 'Tạo bộ từ mới'}</Text>
    <Text style={styles.subtitle}>Tạo một chủ đề riêng để thêm những từ bạn muốn học.</Text>
    <AppInput label="Tên bộ từ *" value={title} onChangeText={setTitle} placeholder="Ví dụ: Giao tiếp hằng ngày" error={titleError} />
    <AppInput label="Mô tả" value={description} onChangeText={setDescription} placeholder="Mục tiêu của bộ từ" multiline />
    <AppInput label="Chủ đề" value={topic} onChangeText={setTopic} placeholder="Du lịch, công việc..." />
    <View style={styles.row}><View style={styles.flex}><AppInput label="Ngôn ngữ nguồn" value={sourceLanguage} onChangeText={setSourceLanguage} /></View><View style={styles.flex}><AppInput label="Ngôn ngữ đích" value={targetLanguage} onChangeText={setTargetLanguage} /></View></View>
    <Text style={styles.label}>Màu bộ từ</Text>
    <View style={styles.palette}>
      {palette.map((item) => {
        const selected = color === item;
        return (
          <Pressable
            accessibilityLabel={`Chọn màu ${item}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={item}
            onPress={() => setColor(item)}
            style={[
              styles.color,
              { backgroundColor: item },
              selected && styles.selected,
            ]}
          >
            {selected ? (
              <Ionicons name="checkmark" size={24} color="#fff" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
    <View style={styles.publicRow}><View style={styles.flex}><Text style={styles.label}>Công khai bộ từ</Text><Text style={styles.hint}>Người khác có thể tìm và sao chép bộ này.</Text></View><Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primarySoft }} thumbColor={isPublic ? colors.primary : undefined} /></View>
    <AppButton title={id ? 'Lưu thay đổi' : 'Tạo bộ từ'} onPress={submit} loading={saving} />
  </AppScreen>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({ content: { width: '100%', maxWidth: 620, alignSelf: 'center' }, title: { color: colors.text, fontSize: 25, fontWeight: '900' }, subtitle: { color: colors.muted }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, label: { color: colors.text, fontWeight: '800' }, hint: { color: colors.muted, fontSize: 12, marginTop: 3 }, palette: { flexDirection: 'row', gap: 12 }, color: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, overflow: 'hidden' }, selected: { borderWidth: 3, borderColor: colors.text }, publicRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, backgroundColor: colors.surface } });
