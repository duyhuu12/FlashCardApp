import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { AppScreen } from "@/src/components/AppScreen";
import { useAuth } from "@/src/context/AuthContext";
import {
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import { friendlyError } from "@/src/utils/errors";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function RegisterScreen() {
  const { signUp, configured } = useAuth();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return setError("Tên cần có ít nhất 2 ký tự.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Email không hợp lệ.");
    if (password.length < 6)
      return setError("Mật khẩu cần có ít nhất 6 ký tự.");
    if (password !== confirm) return setError("Mật khẩu xác nhận chưa khớp.");
    setLoading(true);
    setError("");
    try {
      await signUp(name, email, password);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.brand}>
        <Image
          accessibilityLabel="Cá heo DolphinLingo đang chào"
          contentFit="cover"
          source={require("../../assets/images/hi-dolphin.png")}
          style={styles.logoImage}
          transition={180}
        />
        <Text style={styles.appName}>DolphinLingo</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.title, { textAlign: "center" }]}>
          Tạo tài khoản
        </Text>
        <AppInput
          label=""
          value={name}
          onChangeText={setName}
          placeholder="Vui lòng nhập tên"
        />
        <AppInput
          label=""
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Vui lòng nhập Email"
        />
        <AppInput
          label=""
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Tối thiểu 6 ký tự"
        />
        <AppInput
          label=""
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Nhập lại mật khẩu"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          title="Tạo tài khoản"
          onPress={submit}
          loading={loading}
          disabled={!configured}
        />
        <Text style={styles.switch}>
          Đã có tài khoản?{" "}
          <Link href="/(auth)/login" style={styles.link}>
            Đăng nhập
          </Link>
        </Text>
      </View>
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    screen: { flexGrow: 1, justifyContent: "center" },
    brand: { alignItems: "center", gap: 8, marginBottom: 8 },
    logoImage: {
      width: 116,
      height: 116,
      borderRadius: 30,
    },
    appName: { fontSize: 32, fontWeight: "900", color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 22,
      gap: 15,
      ...shadows.card,
    },
    title: { color: colors.text, fontSize: 27, fontWeight: "900" },
    subtitle: { color: colors.muted, lineHeight: 21 },
    error: { color: colors.danger },
    switch: { textAlign: "center", color: colors.muted },
    link: { color: colors.primary, fontWeight: "800" },
  });
