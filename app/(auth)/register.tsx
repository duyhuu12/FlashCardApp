import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { AppScreen } from '@/src/components/AppScreen';
import { useAuth } from '@/src/context/AuthContext';
import { colors, shadows } from '@/src/theme/colors';
import { friendlyError } from '@/src/utils/errors';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function RegisterScreen() {
  const { signUp, configured } = useAuth();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return setError('Tên cần có ít nhất 2 ký tự.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Email không hợp lệ.');
    if (password.length < 6) return setError('Mật khẩu cần có ít nhất 6 ký tự.');
    if (password !== confirm) return setError('Mật khẩu xác nhận chưa khớp.');
    setLoading(true); setError('');
    try { await signUp(name, email, password); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }

  return <AppScreen contentStyle={styles.screen}>
    <View style={styles.card}>
      <Text style={styles.title}>Tạo tài khoản</Text><Text style={styles.subtitle}>Bắt đầu xây bộ từ vựng của riêng bạn.</Text>
      <AppInput label="Tên hiển thị" value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
      <AppInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="ban@example.com" />
      <AppInput label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry placeholder="Tối thiểu 6 ký tự" />
      <AppInput label="Xác nhận mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Nhập lại mật khẩu" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Tạo tài khoản" onPress={submit} loading={loading} disabled={!configured} />
      <Text style={styles.switch}>Đã có tài khoản? <Link href="/(auth)/login" style={styles.link}>Đăng nhập</Link></Text>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center' }, card: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, gap: 15, ...shadows.card },
  title: { color: colors.text, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, lineHeight: 21 }, error: { color: colors.danger },
  switch: { textAlign: 'center', color: colors.muted }, link: { color: colors.primary, fontWeight: '800' },
});
