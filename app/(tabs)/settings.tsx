import { AppButton } from "@/src/components/AppButton";
import { AppInput } from "@/src/components/AppInput";
import { AppScreen } from "@/src/components/AppScreen";
import { useAuth } from "@/src/context/AuthContext";
import { requireFirebase } from "@/src/services/firebase";
import {
  cancelReminder,
  scheduleDailyReminder,
} from "@/src/services/notificationService";
import { colors, shadows } from "@/src/theme/colors";
import { friendlyError } from "@/src/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export default function SettingsScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState("20");
  const [minute, setMinute] = useState("00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.reminderEnabled);
    setHour(String(profile.reminderHour).padStart(2, "0"));
    setMinute(String(profile.reminderMinute).padStart(2, "0"));
  }, [profile]);

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
          ? `PenguinLingo sẽ nhắc bạn lúc ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} mỗi ngày.`
          : "Đã tắt nhắc học hằng ngày.",
      );
    } catch (e) {
      Alert.alert("Không thể lưu", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <Text style={styles.title}>Cài đặt</Text>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.displayName || user?.email || "L")
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>
            {profile?.displayName || user?.displayName || "Người học"}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.heading}>
          <View style={styles.bell}>
            <Ionicons name="notifications" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Nhắc ôn hằng ngày</Text>
            <Text style={styles.help}>Thông báo cục bộ trên thiết bị này.</Text>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thông tin ứng dụng</Text>
        <Text style={styles.help}>PenguinLingo - Phiên bản 1.0.0</Text>
        <Text style={styles.help}>Học từ vựng bằng lặp lại ngắt quãng.</Text>
        <Text style={styles.credit}>
          Dữ liệu bộ 3.000 từ được chọn lọc từ thichhoc-dict, giấy phép CC BY-SA
          4.0.
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL("https://github.com/thichhoc-org/thichhoc-dict")
          }
        >
          <Text style={styles.link}>Xem nguồn và giấy phép dữ liệu</Text>
        </Pressable>
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 25, fontWeight: "900" },
  profile: { flexDirection: "row", alignItems: "center", gap: 13 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  avatarText: { color: "#fff", fontSize: 23, fontWeight: "900" },
  name: { color: colors.text, fontSize: 18, fontWeight: "900" },
  email: { color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 17,
    gap: 15,
    ...shadows.card,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  link: { color: colors.primary, fontWeight: "800" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  colon: { color: colors.text, fontSize: 25, marginTop: 21 },
  warning: { color: colors.warning },
});
