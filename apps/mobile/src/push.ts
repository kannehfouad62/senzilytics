import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { mobileApi } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function registerForMobilePush() {
  if (!Device.isDevice) return "Push notifications require a physical device.";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Senzilytics alerts", description: "Assigned EHS, audit, risk, compliance, and workflow notifications", importance: Notifications.AndroidImportance.HIGH });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return "Push notifications are disabled in device settings.";
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return "Push registration is waiting for the EAS project ID.";
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await mobileApi("/api/mobile/push-token", { method: "POST", body: JSON.stringify({ token: token.data, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" }) });
  return "Push notifications are active.";
}

export type MobilePushOpen = {
  notificationId: string | null;
  link: string | null;
};

export function subscribeToMobileNotificationResponses(onOpen: (open: MobilePushOpen) => void) {
  const handle = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data ?? {};
    const notificationId = typeof data.notificationId === "string" ? data.notificationId : null;
    const link = typeof data.link === "string" ? data.link : null;
    if (notificationId || link) onOpen({ notificationId, link });
    void Notifications.clearLastNotificationResponseAsync();
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) handle(response); }).catch(() => undefined);
  return () => subscription.remove();
}
