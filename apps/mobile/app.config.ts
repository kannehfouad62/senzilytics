import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Senzilytics",
  slug: "senzilytics-mobile",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  scheme: "senzilytics",
  ios: {
    bundleIdentifier: "com.senzilytics.mobile",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.senzilytics.mobile",
    adaptiveIcon: { backgroundColor: "#07111f" },
  },
  plugins: ["expo-secure-store", "expo-notifications", ["expo-sqlite", { useSQLCipher: true }]],
  extra: {
    eas: {
      projectId: "fa7f9a49-5c6a-47c4-82d4-33d747c3d241",
    },
  },
};

export default config;
