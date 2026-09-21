import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "ClassStreak",
  slug: "turf",
  version: "2.0.0",
  scheme: "turf",
  platforms: ["ios"],
  ios: {
    bundleIdentifier: "com.turf.privatealpha",
    buildNumber: "2",
    supportsTablet: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "ClassStreak checks whether you're at a studio or gym you saved, so your sessions count without you doing anything.",
        locationAlwaysAndWhenInUsePermission:
          "ClassStreak checks whether you're at a studio or gym you saved, so your sessions count without you doing anything.",
        isIosBackgroundLocationEnabled: true,
      },
    ],
    "expo-secure-store",
    ["expo-notifications", { enableBackgroundRemoteNotifications: false }],
    ["expo-camera", { cameraPermission: "Take a photo for your ClassStreak session.", microphonePermission: false, recordAudioAndroid: false }],
    ["expo-contacts", { contactsPermission: "Find friends who chose to share their phone number with ClassStreak." }],
    ["expo-image-picker", { photosPermission: "Choose a photo for your ClassStreak session.", cameraPermission: false, microphonePermission: false }],
    ["expo-media-library", { photosPermission: "Choose session photos.", savePhotosPermission: "Save your ClassStreak sticker photo." }],
    "react-native-share",
    ["expo-sqlite", { useSQLCipher: true }],
    "./plugins/with-m1-privacy.cjs",
  ],
};
export default config;
