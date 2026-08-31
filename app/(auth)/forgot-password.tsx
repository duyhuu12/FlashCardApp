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
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const { resetPassword, configured } = useAuth();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim()) {
      return setError("Vui lòng nhập địa chỉ email của bạn.");
    }
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen contentStyle={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>

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
          <Text style={styles.title}>Quên mật khẩu?</Text>
          <Text style={styles.subtitle}>Nhập email đăng ký của bạn.</Text>

          {success ? (
            <View style={styles.successBox}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={colors.success}
              />
              <Text style={styles.successText}>
                Đã gửi liên kết khôi phục mật khẩu! Vui lòng kiểm tra hộp thư
                email (bao gồm cả thư mục Spam/Rác) và làm theo hướng dẫn.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.fields}>
                <AppInput
                  label=""
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Vui lòng nhập Email"
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton
                title="Gửi liên kết khôi phục"
                onPress={submit}
                loading={submitting}
                disabled={!configured || submitting}
                style={styles.submitButton}
              />
            </>
          )}

          <Text style={styles.switch}>
            Nhớ lại mật khẩu?{" "}
            <Link href="/(auth)/login" style={styles.link}>
              Đăng nhập ngay
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    screen: { flexGrow: 1, justifyContent: "flex-start", paddingTop: 8, paddingBottom: 24 },
    keyboardContainer: { flex: 1, justifyContent: "flex-start" },
    header: { marginBottom: 4 },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    pressed: { opacity: 0.7 },
    brand: { alignItems: "center", gap: 4, marginBottom: 12 },
    logoImage: {
      width: 90,
      height: 90,
      borderRadius: 24,
    },
    appName: { fontSize: 26, fontWeight: "900", color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      ...shadows.card,
    },
    title: { color: colors.text, fontSize: 22, fontWeight: "900" },
    subtitle: {
      color: colors.muted,
      lineHeight: 20,
      marginBottom: 14,
      marginTop: 4,
    },
    fields: { gap: 12 },
    error: { color: colors.danger, lineHeight: 20, marginTop: 10 },
    submitButton: { marginTop: 16 },
    successBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.successSoft,
      marginBottom: 16,
    },
    successText: {
      flex: 1,
      color: colors.success,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    switch: { textAlign: "center", color: colors.muted, marginTop: 16 },
    link: { color: colors.primary, fontWeight: "800" },
  });
