import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { AppScreen } from "@/src/components/AppScreen";
import { useAuth } from "@/src/context/AuthContext";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function LoginScreen() {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<"email" | "google" | null>(null);

  async function submit() {
    if (!email.trim() || !password)
      return setError("Vui lòng nhập đầy đủ email và mật khẩu.");
    setSubmitting("email");
    setError("");
    try {
      await signIn(email, password);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(null);
    }
  }

  async function submitGoogle() {
    setSubmitting("google");
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(null);
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
        <Text style={styles.subtitle}>Đăng nhập để bắt đầu học từ vựng</Text>
        {!configured ? (
          <View style={styles.config}>
            <Text style={styles.configText}>
              Chưa cấu hình Firebase. Hãy sao chép .env.example thành .env và
              điền thông tin dự án.
            </Text>
          </View>
        ) : null}
        <View style={styles.fields}>
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
            placeholder="Vui lòng nhập mật khẩu"
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          title="Đăng nhập"
          onPress={submit}
          loading={submitting === "email"}
          disabled={!configured || submitting !== null}
          style={styles.loginButton}
        />
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Hoặc</Text>
          <View style={styles.dividerLine} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng nhập bằng Google"
          disabled={!configured || submitting !== null}
          onPress={submitGoogle}
          style={({ pressed }) => [
            styles.googleButton,
            (!configured || submitting !== null) && styles.googleButtonDisabled,
            pressed && styles.googleButtonPressed,
          ]}
        >
          {submitting === "google" ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons name="logo-google" size={21} color="#4285F4" />
          )}
          <Text style={styles.googleButtonText}>Đăng nhập bằng Google</Text>
        </Pressable>
        <Text style={styles.switch}>
          Chưa có tài khoản?{" "}
          <Link href="/(auth)/register" style={styles.link}>
            Đăng ký ngay
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
    tagline: { color: colors.muted, fontSize: 15 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 22,
      ...shadows.card,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: "900" },
    subtitle: { color: colors.muted, lineHeight: 21, marginBottom: 16 },
    config: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.warningSoft,
      marginBottom: 16,
    },
    configText: { color: colors.warning, lineHeight: 20 },
    fields: { gap: 12 },
    error: { color: colors.danger, lineHeight: 20, marginTop: 10 },
    loginButton: { marginTop: 16 },
    switch: { textAlign: "center", color: colors.muted, marginTop: 16 },
    link: { color: colors.primary, fontWeight: "800" },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 18,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    googleButton: {
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    googleButtonDisabled: { opacity: 0.55 },
    googleButtonPressed: { opacity: 0.82 },
    googleButtonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  });
