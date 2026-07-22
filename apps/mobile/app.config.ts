import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Senzilytics",
  slug: "senzilytics-mobile",
  owner: "senzilytics-app",
  version: "0.1.0",
  description: "Secure EHS, ESG, risk, audit, and compliance field intelligence for Senzilytics Premium tenants.",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  scheme: "senzilytics",
  backgroundColor: "#07111f",
  primaryColor: "#67e8f9",
  ios: {
    bundleIdentifier: "com.senzilytics.mobile",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.senzilytics.mobile",
    edgeToEdgeEnabled: true,
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
