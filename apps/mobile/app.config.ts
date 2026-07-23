import type { ExpoConfig } from "expo/config";

const notificationMode: "development" | "production" = process.env.EAS_BUILD_PROFILE === "production" ? "production" : "development";

const config: ExpoConfig = {
  name: "Senzilytics",
  slug: "senzilytics-mobile",
  owner: "senzilytics-app",
  version: "1.0.0",
  platforms: ["ios", "android"],
  description: "Secure EHS, ESG, risk, audit, and compliance field intelligence for Senzilytics Premium tenants.",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  scheme: "senzilytics",
  backgroundColor: "#07111f",
  primaryColor: "#67e8f9",
  icon: "./assets/app-icon.png",
  ios: {
    bundleIdentifier: "com.senzilytics.mobile",
    supportsTablet: true,
    icon: "./assets/app-icon.png",
    config: { usesNonExemptEncryption: false },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"] },
      ],
    },
  },
  android: {
    package: "com.senzilytics.mobile",
    icon: "./assets/app-icon.png",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-foreground.png",
      monochromeImage: "./assets/monochrome-icon.png",
      backgroundColor: "#07111f",
    },
  },
  plugins: [
    "expo-secure-store",
    ["expo-image-picker", {
      photosPermission: "Allow Senzilytics to select photos used as evidence in your authorized EHS records.",
      cameraPermission: "Allow Senzilytics to capture photos used as evidence in your authorized EHS records.",
      microphonePermission: false,
    }],
    "expo-document-picker",
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#22D3EE", defaultChannel: "default", mode: notificationMode }],
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 220, resizeMode: "contain", backgroundColor: "#07111f" }],
    ["expo-sqlite", { useSQLCipher: true }],
  ],
  extra: {
    eas: {
      projectId: "fa7f9a49-5c6a-47c4-82d4-33d747c3d241",
    },
  },
};

export default config;
