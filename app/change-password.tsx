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
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ChangePasswordScreen() {
  const { changePassword, signOut, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isGoogleUser = user?.providerData.some(
    (p) => p.providerId === "google.com",
  );

  async function submit() {
    if (!currentPassword) {
      return setError("Vui lòng nhập mật khẩu hiện tại.");
    }
    if (!newPassword) {
      return setError("Vui lòng nhập mật khẩu mới.");
    }
    if (newPassword.length < 6) {
      return setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
    }
    if (newPassword === currentPassword) {
      return setError("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
    }
    if (newPassword !== confirmPassword) {
      return setError("Mật khẩu xác nhận không khớp.");
    }

    setSubmitting(true);
    setError("");

    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(
        "Đổi mật khẩu thành công!",
        "Mật khẩu của bạn đã được cập nhật. Hệ thống sẽ tự động đăng xuất để bạn đăng nhập lại bằng mật khẩu mới.",
        [
          {
            text: "Đồng ý",
            onPress: async () => {
              await signOut();
            },
          },
        ],
        { cancelable: false },
      );
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
            source={require("../assets/images/hi-dolphin.png")}
            style={styles.logoImage}
            transition={180}
          />
          <Text style={styles.appName}>DolphinLingo</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Đổi mật khẩu</Text>
          <Text style={styles.subtitle}>
            Cập nhật mật khẩu mới cho tài khoản{" "}
            <Text style={styles.emailHighlight}>{user?.email}</Text>.
          </Text>

          {isGoogleUser ? (
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle"
                size={22}
                color={colors.primary}
              />
              <Text style={styles.infoText}>
                Tài khoản của bạn đăng nhập bằng Google. Vui lòng quản lý mật
                khẩu trực tiếp trong cài đặt tài khoản Google của bạn.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.fields}>
                <AppInput
                  label="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    if (error) setError("");
                  }}
                  secureTextEntry
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <AppInput
                  label="Mật khẩu mới"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (error) setError("");
                  }}
                  secureTextEntry
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                />
                <AppInput
                  label="Xác nhận mật khẩu mới"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError("");
                  }}
                  secureTextEntry
                  placeholder="Nhập lại mật khẩu mới"
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <AppButton
                title="Đổi mật khẩu & Đăng xuất"
                onPress={submit}
                loading={submitting}
                disabled={submitting}
                style={styles.submitButton}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    screen: {
      flexGrow: 1,
      justifyContent: "flex-start",
      paddingTop: 8,
      paddingBottom: 24,
    },
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
    brand: { alignItems: "center", gap: 4, marginBottom: 8 },
    logoImage: {
      width: 80,
      height: 80,
      borderRadius: 22,
    },
    appName: { fontSize: 24, fontWeight: "900", color: colors.text },
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
    emailHighlight: { color: colors.text, fontWeight: "700" },
    fields: { gap: 10 },
    error: { color: colors.danger, lineHeight: 20, marginTop: 10 },
    submitButton: { marginTop: 16 },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      marginBottom: 16,
    },
    infoText: {
      flex: 1,
      color: colors.primary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
  });
