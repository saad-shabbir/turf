import { useCallback, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Action, Copy, Field, Page } from "../src/components/ui";
import { rpc } from "../src/auth/client";
import { logout, pause } from "../src/location/lifecycle";
export default function Settings() {
  const [name, setName] = useState("");
  const [gym, setGym] = useState(false);
  const [work, setWork] = useState(false);
  const [mosque, setMosque] = useState(false);
  const [notice, setNotice] = useState("");
  useFocusEffect(
    useCallback(() => {
      void rpc("get_my_setup_state", {})
        .then((s) => {
          setName(s.profile?.display_name ?? "");
          setGym(s.settings?.share_gym ?? false);
          setWork(s.settings?.share_work ?? false);
          setMosque(s.settings?.share_mosque ?? false);
        })
        .catch(() => setNotice("Sign in to load your saved preferences."));
    }, []),
  );
  return (
    <Page title="Privacy and account">
      <Copy>
        M1 shares only safe display names and pairing state. Your places,
        timestamps and diagnostics remain owner-only. The project administrator
        can access server data; this is not end-to-end encryption.
      </Copy>
      <Field label="Display name" value={name} onChange={setName} />
      <Copy>
        Preferences for future sharing. No activity feed exists in M1; all start
        off.
      </Copy>
      {[
        ["Gym", gym, setGym],
        ["Work", work, setWork],
        ["Mosque", mosque, setMosque],
      ].map(([label, value, setter]) => (
        <View key={String(label)}>
          <Copy>{String(label)}</Copy>
          <Switch
            accessibilityLabel={`Allow future ${label} summaries`}
            value={value as boolean}
            onValueChange={setter as (v: boolean) => void}
          />
        </View>
      ))}
      <Action
        title="Save my preferences"
        run={async () => {
          await rpc("update_my_settings", {
            patch: {
              ...(name.trim() ? { display_name: name.trim() } : {}),
              share_gym: gym,
              share_work: work,
              share_mosque: mosque,
            },
          });
          setNotice("Preferences saved. No activity shared in M1.");
        }}
      />
      <Copy>{notice}</Copy>
      <Action
        title="Withdraw collection consent"
        run={async () => {
          await pause();
          await rpc("update_my_settings", {
            patch: { collection_consent: false },
          });
          setNotice("Collection stopped and consent withdrawn.");
        }}
      />
      <Copy>
        Signing out deletes private local data, including unsynchronized visits.
        Uninstalling can also lose queued evidence.
      </Copy>
      <Action
        title="Sign out and clear local data"
        run={async () => {
          await logout();
          router.replace("/sign-in");
        }}
      />
      <Action
        title="Delete my app data…"
        run={async () => {
          Alert.alert(
            "Delete your Turf app data?",
            "This ends the pair and permanently deletes your app records. Your friend’s private history is preserved. Your Auth account remains.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete my app data",
                style: "destructive",
                onPress: () => {
                  void (async () => {
                    await pause("deleted_data");
                    await rpc("delete_my_app_data", {});
                    await logout();
                    router.replace("/sign-in");
                  })().catch(() =>
                    setNotice(
                      "Deletion not confirmed. Capture is paused. Reconnect and retry.",
                    ),
                  );
                },
              },
            ],
          );
        }}
      />
      <Copy>
        To delete your Auth account too: ask the Supabase project administrator
        to delete your Auth user after app-data deletion. No self-service
        account deletion is claimed. Re-enrollment requires deliberate
        administrator setup.
      </Copy>
      <Copy>
        Retention: local acknowledged logs 7 days, unsent logs and raw server
        events 30 days, visits 90 days. Cleanup runs on foreground activity;
        server deadlines are opportunistic until an administrator schedules
        maintenance.
      </Copy>
    </Page>
  );
}
