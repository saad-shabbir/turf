import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Turf",
  slug: "turf",
  version: "1.0.0",
  scheme: "turf",
  platforms: ["ios"],
  ios: {
    bundleIdentifier: "com.turf.privatealpha",
    buildNumber: "1",
    supportsTablet: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Turf uses your location to help you save places you choose.",
        locationAlwaysAndWhenInUsePermission:
          "Turf detects visits to your saved places while your phone is locked. You control collection and can pause at any time.",
        isIosBackgroundLocationEnabled: true,
      },
    ],
    "expo-secure-store",
    ["expo-sqlite", { useSQLCipher: true }],
    "./plugins/with-m1-privacy.cjs",
  ],
};
export default config;
