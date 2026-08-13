import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  previousId?: string | null,
) {
  if (Platform.OS === "web")
    throw new Error("Thông báo hằng ngày chỉ hỗ trợ trên Android và iOS.");
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Bạn chưa cấp quyền gửi thông báo. Hãy bật quyền trong cài đặt thiết bị.",
    );
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-review", {
      name: "Nhắc ôn tập hằng ngày",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#087A9B",
    });
  }
  if (previousId)
    await Notifications.cancelScheduledNotificationAsync(previousId).catch(
      () => undefined,
    );
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Đến giờ ôn từ rồi! 📚",
      body: "Dành vài phút với PenguinLingo để ghi nhớ lâu hơn.",
      data: { url: "/(tabs)" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: "daily-review",
    },
  });
}

export async function cancelReminder(id?: string | null) {
  if (id && Platform.OS !== "web")
    await Notifications.cancelScheduledNotificationAsync(id);
}
