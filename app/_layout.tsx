import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { reconcile } from "../src/location/lifecycle";
export default function Layout() {
  useEffect(() => {
    void reconcile().catch(() => {});
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void reconcile().catch(() => {});
    });
    return () => subscription.remove();
  }, []);
  return <Stack screenOptions={{ headerTitle: "Turf · Private alpha" }} />;
}
