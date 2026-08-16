import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { AppScreen } from "@/src/components/AppScreen";
import { avatarOptions, getAvatarSource } from "@/src/constants/avatarOptions";
import { useAuth } from "@/src/context/AuthContext";
import { requireFirebase } from "@/src/services/firebase";
import {
  cancelReminder,
  scheduleDailyReminder,
} from "@/src/services/notificationService";
import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
  type AppShadows,
} from "@/src/theme/colors";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { user, profile, refreshProfile, signOut, updateDisplayName } =
    useAuth();
  const { colors, isDark, setThemePreference } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState("20");
  const [minute, setMinute] = useState("00");
  const [saving, setSaving] = useState(false);
  const [reminderMenuOpen, setReminderMenuOpen] = useState(false);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [savingAvatarId, setSavingAvatarId] = useState("");
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const drawerProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.reminderEnabled);
    setHour(String(profile.reminderHour).padStart(2, "0"));
    setMinute(String(profile.reminderMinute).padStart(2, "0"));
  }, [profile]);

  useEffect(() => {
    if (nameEditorOpen) return;
    setDisplayName(profile?.displayName || user?.displayName || "Người học");
  }, [nameEditorOpen, profile?.displayName, user?.displayName]);

  async function saveDisplayName() {
    const nextName = displayName.trim().replace(/\s+/g, " ");
    if (nextName.length < 2) {
      setNameError("Tên hiển thị cần có ít nhất 2 ký tự.");
      return;
    }
    if (nextName.length > 40) {
      setNameError("Tên hiển thị không được vượt quá 40 ký tự.");
      return;
    }
    if (nextName === profile?.displayName) {
      setNameEditorOpen(false);
      return;
    }
    setSavingName(true);
    setNameError("");
    try {
      await updateDisplayName(nextName);
      setNameEditorOpen(false);
    } catch (error) {
      setNameError(friendlyError(error));
    } finally {
      setSavingName(false);
    }
  }

  async function saveReminder() {
    if (!user) return;
    const h = Number(hour);
    const m = Number(minute);
    if (
      !Number.isInteger(h) ||
      h < 0 ||
      h > 23 ||
      !Number.isInteger(m) ||
      m < 0 ||
      m > 59
    ) {
      Alert.alert("Giờ không hợp lệ", "Giờ phải từ 0–23 và phút từ 0–59.");
      return;
    }
    setSaving(true);
    try {
      const { db } = requireFirebase();
      let notificationId: string | null = profile?.notificationId ?? null;
      if (enabled)
        notificationId = await scheduleDailyReminder(h, m, notificationId);
      else {
        await cancelReminder(notificationId);
        notificationId = null;
      }
      await updateDoc(doc(db, "users", user.uid), {
        reminderEnabled: enabled,
        reminderHour: h,
        reminderMinute: m,
        notificationId,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      Alert.alert(
        "Đã lưu",
        enabled
          ? `DolphinLingo sẽ nhắc bạn lúc ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} mỗi ngày.`
          : "Đã tắt nhắc học hằng ngày.",
      );
    } catch (e) {
      Alert.alert("Không thể lưu", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  async function selectAvatar(avatarId: string) {
    if (!user || avatarId === profile?.avatarId) {
      setAvatarPickerOpen(false);
      return;
    }
    setSavingAvatarId(avatarId);
    try {
      const { db } = requireFirebase();
      await Promise.all([
        updateDoc(doc(db, "users", user.uid), {
          avatarId,
          updatedAt: serverTimestamp(),
        }),
        setDoc(
          doc(db, "leaderboard", user.uid),
          { uid: user.uid, avatarId },
          { merge: true },
        ),
      ]);
      await refreshProfile();
      setAvatarPickerOpen(false);
    } catch (error) {
      Alert.alert("Không thể đổi avatar", friendlyError(error));
    } finally {
      setSavingAvatarId("");
    }
  }

  function toggleSettingsPanel() {
    if (settingsPanelOpen) {
      Animated.timing(drawerProgress, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }).start(() => {
        setReminderMenuOpen(false);
        setInfoMenuOpen(false);
        setSettingsPanelOpen(false);
      });
      return;
    }

    drawerProgress.setValue(1);
    setSettingsPanelOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(drawerProgress, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    });
  }

  function openReminderSettings() {
    setReminderMenuOpen(true);
    if (settingsPanelOpen) return;

    drawerProgress.setValue(1);
    setSettingsPanelOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(drawerProgress, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    });
  }

  return (
    <AppScreen contentStyle={styles.screen} safeAreaEdges={["left", "right"]}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={styles.profileHero}>
        <Pressable
          accessibilityLabel="Chọn avatar"
          accessibilityRole="button"
          onPress={() => setAvatarPickerOpen(true)}
          style={styles.profileHeroAvatar}
        >
          <Image
            source={getAvatarSource(profile?.avatarId)}
            resizeMode="cover"
            style={styles.profileHeroImage}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={settingsPanelOpen ? "Đóng cài đặt" : "Mở cài đặt"}
          accessibilityState={{ expanded: settingsPanelOpen }}
          onPress={toggleSettingsPanel}
          style={[
            styles.profileSettingsButton,
            { top: insets.top + 12 },
            settingsPanelOpen && styles.profileSettingsButtonActive,
          ]}
        >
          <Ionicons
            name={settingsPanelOpen ? "close" : "settings"}
            size={24}
            color="#fff"
          />
        </Pressable>
      </View>
      <View style={styles.profileHeader}>
        <View style={styles.profileHeaderCopy}>
          <Text style={styles.name}>
            {profile?.displayName || user?.displayName || "Người học"}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sửa tên hiển thị"
          onPress={() => {
            setDisplayName(
              profile?.displayName || user?.displayName || "Người học",
            );
            setNameError("");
            setNameEditorOpen(true);
          }}
          style={styles.settingsIcon}
        >
          <Ionicons name="pencil" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <Pressable
        accessibilityHint="Mở phần cài đặt giờ nhắc ôn"
        accessibilityRole="button"
        onPress={openReminderSettings}
        style={styles.reminderShortcut}
      >
        <View style={styles.reminderShortcutIcon}>
          <Ionicons
            name={enabled ? "notifications" : "notifications-off-outline"}
            size={25}
            color={colors.primary}
          />
        </View>
        <View style={styles.reminderShortcutCopy}>
          <Text style={styles.reminderShortcutTitle}>Nhắc ôn hằng ngày</Text>
          <Text style={styles.reminderShortcutText}>
            {enabled
              ? `Mỗi ngày lúc ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
              : "Chưa bật lịch nhắc ôn"}
          </Text>
        </View>
        <View
          style={[
            styles.reminderStatus,
            enabled && styles.reminderStatusEnabled,
          ]}
        >
          <Text
            style={[
              styles.reminderStatusText,
              enabled && styles.reminderStatusTextEnabled,
            ]}
          >
            {enabled ? "Đã bật" : "Thiết lập"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={toggleSettingsPanel}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={settingsPanelOpen}
      >
        <Pressable style={styles.drawerBackdrop} onPress={toggleSettingsPanel}>
          <Animated.View
            style={[
              styles.settingsDrawer,
              {
                paddingTop: insets.top + 12,
                paddingBottom: Math.max(insets.bottom, 16),
              },
              {
                transform: [
                  {
                    translateX: drawerProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 520],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable style={styles.drawerContent} onPress={() => undefined}>
            <View style={styles.drawerHeader}>
              <Image
                source={getAvatarSource(profile?.avatarId)}
                resizeMode="cover"
                style={styles.drawerAvatar}
              />
              <View style={styles.drawerProfileCopy}>
                <Text numberOfLines={1} style={styles.drawerName}>
                  {profile?.displayName || user?.displayName || "Người học"}
                </Text>
                <Text numberOfLines={1} style={styles.drawerEmail}>
                  {user?.email}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng cài đặt"
                accessibilityRole="button"
                hitSlop={8}
                onPress={toggleSettingsPanel}
                style={styles.drawerClose}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.drawerTitle}>Cài đặt của bạn</Text>
            <ScrollView
              contentContainerStyle={styles.settingsPanel}
              showsVerticalScrollIndicator={false}
            >
          <View style={styles.card}>
            <View style={[styles.heading, styles.cardHeaderTint]}>
              <View style={[styles.bell, styles.cardHeaderIcon]}>
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Chế độ tối</Text>
                <Text style={styles.help}>{isDark ? "Đang bật" : "Đang tắt"}</Text>
              </View>
              <Switch
                accessibilityLabel="Bật hoặc tắt chế độ tối"
                value={isDark}
                onValueChange={(value) =>
                  setThemePreference(value ? "dark" : "light")
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.appearanceHint}>
              Lần đầu ứng dụng sẽ tự dùng giao diện sáng hoặc tối theo cài đặt
              điện thoại.
            </Text>
          </View>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: reminderMenuOpen }}
              onPress={() => setReminderMenuOpen((current) => !current)}
              style={[styles.heading, styles.cardHeaderTint]}
            >
              <View style={[styles.bell, styles.cardHeaderIcon]}>
                <Ionicons
                  name="notifications"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Nhắc ôn hằng ngày</Text>
                <Text style={styles.help}>
                  {enabled
                    ? `Đang bật · ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
                    : "Đang tắt"}
                </Text>
              </View>
              <Ionicons
                name={reminderMenuOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.muted}
              />
            </Pressable>
            {reminderMenuOpen ? (
              <View style={styles.reminderContent}>
                <View style={styles.reminderToggle}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.themeMenuText}>Bật nhắc ôn tập</Text>
                    <Text style={styles.reminderHint}>
                      Thông báo cục bộ trên thiết bị này.
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={setEnabled}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
                {Platform.OS === "web" ? (
                  <Text style={styles.warning}>
                    Thông báo chỉ được cấu hình trên ứng dụng Android/iOS.
                  </Text>
                ) : null}
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Giờ"
                      value={hour}
                      onChangeText={setHour}
                      keyboardType="number-pad"
                      maxLength={2}
                      editable={enabled}
                    />
                  </View>
                  <Text style={styles.colon}>:</Text>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Phút"
                      value={minute}
                      onChangeText={setMinute}
                      keyboardType="number-pad"
                      maxLength={2}
                      editable={enabled}
                    />
                  </View>
                </View>
                <AppButton
                  title="Lưu lịch nhắc"
                  onPress={saveReminder}
                  loading={saving}
                  disabled={Platform.OS === "web"}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: infoMenuOpen }}
              onPress={() => setInfoMenuOpen((current) => !current)}
              style={[styles.heading, styles.cardHeaderTint]}
            >
              <View style={[styles.bell, styles.cardHeaderIcon]}>
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Thông tin ứng dụng</Text>
                <Text style={styles.help}>DolphinLingo · Phiên bản 1.0.0</Text>
              </View>
              <Ionicons
                name={infoMenuOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.muted}
              />
            </Pressable>
            {infoMenuOpen ? (
              <View style={styles.infoContent}>
                <Text style={styles.help}>
                  Học từ vựng bằng lặp lại ngắt quãng.
                </Text>
                <Text style={styles.credit}>
                  Dữ liệu bộ 3.000 từ được chọn lọc từ thichhoc-dict, giấy phép
                  CC BY-SA 4.0.
                </Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    Linking.openURL(
                      "https://github.com/thichhoc-org/thichhoc-dict",
                    )
                  }
                >
                  <Text style={styles.link}>
                    Xem nguồn và giấy phép dữ liệu
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <AppButton
            title="Đăng xuất"
            variant="danger"
            onPress={() =>
              Alert.alert(
                "Đăng xuất?",
                "Bạn có thể đăng nhập lại bất cứ lúc nào.",
                [
                  { text: "Hủy", style: "cancel" },
                  { text: "Đăng xuất", style: "destructive", onPress: signOut },
                ],
              )
            }
          />
            </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={nameEditorOpen}
        onRequestClose={() => !savingName && setNameEditorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          style={styles.keyboardAvoider}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !savingName && setNameEditorOpen(false)}
          >
            <Pressable style={styles.nameSheet} onPress={() => undefined}>
              <View style={styles.avatarSheetHeader}>
                <View style={styles.avatarSheetCopy}>
                  <Text style={styles.avatarSheetTitle}>Sửa tên hiển thị</Text>
                  <Text style={styles.avatarSheetHint}>
                    Tên này sẽ xuất hiện trên hồ sơ và bảng xếp hạng.
                  </Text>
                </View>
                <Pressable
                  disabled={savingName}
                  hitSlop={8}
                  onPress={() => setNameEditorOpen(false)}
                >
                  <Ionicons name="close" size={25} color={colors.muted} />
                </Pressable>
              </View>
              <AppInput
                autoCapitalize="words"
                autoFocus
                error={nameError}
                label="Tên hiển thị"
                maxLength={40}
                onChangeText={(value) => {
                  setDisplayName(value);
                  if (nameError) setNameError("");
                }}
                onSubmitEditing={saveDisplayName}
                returnKeyType="done"
                value={displayName}
              />
              <View style={styles.nameActions}>
                <AppButton
                  disabled={savingName}
                  onPress={() => setNameEditorOpen(false)}
                  style={styles.nameAction}
                  title="Hủy"
                  variant="ghost"
                />
                <AppButton
                  loading={savingName}
                  onPress={saveDisplayName}
                  style={styles.nameAction}
                  title="Lưu tên"
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={avatarPickerOpen}
        onRequestClose={() => !savingAvatarId && setAvatarPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !savingAvatarId && setAvatarPickerOpen(false)}
        >
          <Pressable style={styles.avatarSheet} onPress={() => undefined}>
            <View style={styles.avatarSheetHeader}>
              <View style={styles.avatarSheetCopy}>
                <Text style={styles.avatarSheetTitle}>Chọn avatar</Text>
                <Text style={styles.avatarSheetHint}>
                  Chọn một người bạn đồng hành của bạn.
                </Text>
              </View>
              <Pressable
                disabled={Boolean(savingAvatarId)}
                hitSlop={8}
                onPress={() => setAvatarPickerOpen(false)}
              >
                <Ionicons name="close" size={25} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.avatarGrid}>
              {avatarOptions.map((avatar) => {
                const selected = avatar.id === (profile?.avatarId || "avt1");
                const saving = savingAvatarId === avatar.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={Boolean(savingAvatarId)}
                    key={avatar.id}
                    onPress={() => selectAvatar(avatar.id)}
                    style={[
                      styles.avatarChoice,
                      selected && styles.avatarChoiceSelected,
                    ]}
                  >
                    <Image
                      source={avatar.source}
                      resizeMode="cover"
                      style={styles.avatarChoiceImage}
                    />
                    {saving ? (
                      <View style={styles.avatarSaving}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : selected ? (
                      <View style={styles.avatarSelectedBadge}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const createStyles = (colors: AppColors, shadows: AppShadows) =>
  StyleSheet.create({
    screen: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      paddingBottom: 36,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    profileHeaderCopy: { flex: 1 },
    settingsIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    reminderShortcut: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    reminderShortcutIcon: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    reminderShortcutCopy: { flex: 1 },
    reminderShortcutTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    reminderShortcutText: { color: colors.muted, fontSize: 12, marginTop: 4 },
    reminderStatus: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 99,
      backgroundColor: colors.background,
    },
    reminderStatusEnabled: { backgroundColor: colors.successSoft },
    reminderStatusText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    reminderStatusTextEnabled: { color: colors.success },
    nameSheet: {
      padding: 20,
      paddingBottom: 28,
      gap: 18,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surface,
    },
    nameActions: { flexDirection: "row", gap: 10 },
    nameAction: { flex: 1 },
    keyboardAvoider: { flex: 1 },
    name: { color: colors.text, fontSize: 27, fontWeight: "900" },
    email: { color: colors.muted, marginTop: 4 },
    profileHero: {
      height: 315,
      position: "relative",
      overflow: "hidden",
      alignSelf: "stretch",
      marginHorizontal: -20,
      marginTop: -20,
      backgroundColor: colors.primarySoft,
    },
    profileHeroAvatar: { ...StyleSheet.absoluteFillObject },
    profileHeroImage: { width: "100%", height: "100%" },
    profileSettingsButton: {
      position: "absolute",
      right: 18,
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.85)",
      borderRadius: 17,
      backgroundColor: "rgba(7,27,37,0.7)",
      zIndex: 2,
      elevation: 4,
    },
    profileSettingsButtonActive: { backgroundColor: colors.primary },
    drawerBackdrop: {
      flex: 1,
      alignItems: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    settingsDrawer: {
      width: "89%",
      maxWidth: 460,
      height: "100%",
      paddingHorizontal: 16,
      backgroundColor: colors.background,
      ...shadows.card,
    },
    drawerContent: { flex: 1 },
    drawerHeader: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    drawerAvatar: { width: 52, height: 52, borderRadius: 18 },
    drawerProfileCopy: { flex: 1 },
    drawerName: { color: colors.text, fontSize: 18, fontWeight: "900" },
    drawerEmail: { color: colors.muted, fontSize: 12, marginTop: 3 },
    drawerClose: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
    },
    drawerTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 22,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    settingsPanel: { gap: 12, paddingBottom: 20 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 17,
      gap: 15,
      ...shadows.card,
    },
    heading: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardHeaderTint: {
      minHeight: 68,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    cardHeaderIcon: { backgroundColor: colors.surface },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    help: { color: colors.muted, lineHeight: 20 },
    credit: { color: colors.muted, lineHeight: 20 },
    infoContent: { gap: 10 },
    link: { color: colors.primary, fontWeight: "800" },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    colon: { color: colors.text, fontSize: 25, marginTop: 21 },
    warning: { color: colors.warning },
    reminderContent: { gap: 13 },
    reminderToggle: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    reminderHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
    appearanceHint: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    themeMenuText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      padding: 18,
      backgroundColor: "rgba(0,0,0,0.48)",
    },
    avatarSheet: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    avatarSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    avatarSheetCopy: { flex: 1 },
    avatarSheetTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
    avatarSheetHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
    avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
    avatarChoice: {
      width: "22%",
      aspectRatio: 1,
      flexGrow: 1,
      maxWidth: 105,
      position: "relative",
      padding: 3,
      borderWidth: 2,
      borderColor: "transparent",
      borderRadius: 20,
    },
    avatarChoiceSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    avatarChoiceImage: { width: "100%", height: "100%", borderRadius: 15 },
    avatarSelectedBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 24,
      height: 24,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    avatarSaving: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: "rgba(0,0,0,0.42)",
    },
  });
