import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { mobileApi } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function registerForMobilePush() {
  if (!Device.isDevice) return "Push notifications require a physical device.";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Senzilytics", importance: Notifications.AndroidImportance.HIGH });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return "Push notifications are disabled in device settings.";
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return "Push registration is waiting for the EAS project ID.";
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await mobileApi("/api/mobile/push-token", { method: "POST", body: JSON.stringify({ token: token.data, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" }) });
  return "Push notifications are active.";
}
