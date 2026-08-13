import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { AppScreen } from '@/src/components/AppScreen';
import { useAuth } from '@/src/context/AuthContext';
import { colors, shadows } from '@/src/theme/colors';
import { friendlyError } from '@/src/utils/errors';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError('Vui lòng nhập đầy đủ email và mật khẩu.');
    setLoading(true); setError('');
    try { await signIn(email, password); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.logo}><Ionicons name="layers" size={42} color="#FFFFFF" /></View>
        <Text style={styles.appName}>PenguinLingo</Text>
        <Text style={styles.tagline}>Nhớ lâu hơn, mỗi ngày một chút.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Chào mừng trở lại</Text>
        <Text style={styles.subtitle}>Đăng nhập để tiếp tục hành trình từ vựng.</Text>
        {!configured ? <View style={styles.config}><Text style={styles.configText}>Chưa cấu hình Firebase. Hãy sao chép .env.example thành .env và điền thông tin dự án.</Text></View> : null}
        <AppInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="ban@example.com" />
        <AppInput label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry placeholder="Tối thiểu 6 ký tự" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Đăng nhập" onPress={submit} loading={loading} disabled={!configured} />
        <Text style={styles.switch}>Chưa có tài khoản? <Link href="/(auth)/register" style={styles.link}>Đăng ký ngay</Link></Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center' }, brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logo: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  appName: { fontSize: 32, fontWeight: '900', color: colors.text }, tagline: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, gap: 16, ...shadows.card },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' }, subtitle: { color: colors.muted, lineHeight: 21 },
  config: { padding: 12, borderRadius: 12, backgroundColor: colors.warningSoft }, configText: { color: '#8B541C', lineHeight: 20 },
  error: { color: colors.danger, lineHeight: 20 }, switch: { textAlign: 'center', color: colors.muted }, link: { color: colors.primary, fontWeight: '800' },
});
