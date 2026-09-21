import React, { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { backend, configured } from "../auth/client";
import { read, write } from "../db/local";
import { finishOnboarding, getSnapshot, resetEmail, signIn, signUp } from "./api";
import { newDraft, safeMessage, type Draft, type Snapshot } from "./model";
import { Button, Card, Empty, Input, Logo, Row, Screen, Theme, Txt, useTheme } from "./ui";
import { Onboarding } from "./Onboarding";
import { PlacesPicker } from "./PlacesPicker";

export default function ClassStreakApp() {
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<"onboarding" | "signin" | "forgot" | "reset">("onboarding");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (patch: Partial<Draft>) => setDraft(previous => { const value = { ...previous, ...patch }; void write("cs:draft", value).catch(() => {}); return value; });
  const refresh = useCallback(async () => {
    if (!configured) return;
    const { data } = await backend().auth.getSession();
    setSignedIn(!!data.session);
    if (!data.session) { setSnapshot(null); return; }
    try { const value = await getSnapshot(); setSnapshot(value); await write("cs:snapshot", { auth: data.session.user.id, value }); }
    catch (e) {
      if (e instanceof Error && e.message === "SETUP_REQUIRED") return;
      const cached = await read<{ auth: string; value: Snapshot } | null>("cs:snapshot", null);
      if (cached?.auth === data.session.user.id) setSnapshot(cached.value);
      throw e;
    }
  }, []);
  const run = (action: () => Promise<void>) => { setBusy(true); setMessage(""); void action().catch(e => setMessage(safeMessage(e))).finally(() => setBusy(false)); };
  useEffect(() => {
    void (async () => { setDraft(await read("cs:draft", newDraft())); await refresh(); })().catch(e => setMessage(safeMessage(e))).finally(() => setReady(true));
    const app = AppState.addEventListener("change", state => { if (state === "active") void refresh().catch(() => {}); });
    const handle = async (url: string) => {
      const parsed = new URL(url); const hash = new URLSearchParams(parsed.hash.slice(1)); const code = parsed.searchParams.get("code");
      if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
        await backend().auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! }); setMode("reset");
      } else if (code && /account/.test(url)) { const { error } = await backend().auth.exchangeCodeForSession(code); if (error) throw error; setMode("reset"); }
      else if (/\/j\//.test(parsed.pathname)) change({ invite_code: parsed.pathname.split("/j/")[1]?.replace(/[^A-Z0-9]/gi, "").slice(0, 12) ?? "" });
    };
    void Linking.getInitialURL().then(url => url ? handle(url) : undefined).catch(() => {});
    const links = Linking.addEventListener("url", e => { void handle(e.url).catch(e => setMessage(safeMessage(e))); });
    return () => { app.remove(); links.remove(); };
  }, [refresh]);
  const complete = async () => {
    const value = await finishOnboarding(draft);
    setSnapshot(value); await write("cs:draft", newDraft());
  };
  const accountForm = <View style={{ gap: 12 }}>
    {signedIn ? <Button title="Save my setup" disabled={busy} onPress={() => run(complete)} /> : <>
      <Input label="Email" value={email} onChange={setEmail} keyboard="email-address" />
      <Input label="Password" value={password} onChange={setPassword} secure />
      <Input label="I have a friend code (optional)" value={draft.invite_code} onChange={invite_code => change({ invite_code })} />
      <Button title={busy ? "Creating account…" : "Create account"} disabled={busy || !email.includes("@") || password.length < 8} onPress={() => run(async () => {
        if (await signUp(email, password)) { await complete(); setPassword(""); }
        else setMessage("Check your email to confirm your account, then sign in here. Your setup is saved.");
      })} />
    </>}
    <Button title="Already have an account? Sign in" secondary onPress={() => setMode("signin")} />
    <Pressable onPress={() => setMode("forgot")} style={{ padding: 6 }}><Txt muted size={12} style={{ textAlign: "center" }}>Forgot password</Txt></Pressable>
    <Txt size={11} muted style={{ textAlign: "center" }}>By continuing you agree to the Terms and Privacy Policy.</Txt>
  </View>;
  return <Theme name={snapshot?.profile.theme ?? draft.theme}><SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
    {!!message && <Card style={{ borderRadius: 0, padding: 10 }}><Pressable accessibilityLabel="Dismiss message" onPress={() => setMessage("")}><Txt size={12}>{message}</Txt></Pressable></Card>}
    {!ready || !fontsLoaded ? <Screen><Logo /><Txt muted>Opening your streak…</Txt></Screen> : mode !== "onboarding" ? <Screen><Logo /><Txt serif size={35}>{mode === "signin" ? "Welcome back." : mode === "forgot" ? "Forgot password?" : "Choose a new password."}</Txt>
      {mode !== "reset" && <Input label="Email" value={email} onChange={setEmail} keyboard="email-address" />}
      {mode !== "forgot" && <Input label="Password" value={password} onChange={setPassword} secure />}
      <Button title={busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Save password"} disabled={busy} onPress={() => run(async () => {
        if (mode === "signin") { await signIn(email, password); setPassword(""); await refresh(); setMode("onboarding"); }
        else if (mode === "forgot") { await resetEmail(email); setMessage("If an account exists, a reset link will arrive by email."); }
        else { const { error } = await backend().auth.updateUser({ password }); if (error) throw error; setPassword(""); setMode("onboarding"); await refresh(); }
      })} />
      {mode === "signin" && <Button secondary title="Forgot password" onPress={() => setMode("forgot")} />}
      <Button secondary title="Back" onPress={() => setMode("onboarding")} />
    </Screen> : snapshot ? <FoundationHome snapshot={snapshot} /> : <Onboarding draft={draft} change={change} next={() => change({ step: Math.min(9, draft.step + 1) })} requestLocation={() => run(async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status === "granted") await Location.requestBackgroundPermissionsAsync();
      change({ location_consent: fg.status === "granted", step: 6 });
    })} search={<PlacesPicker value={draft.place} onSelect={place => { change({ place, step: 4 }); }} onError={e => setMessage(safeMessage(e))} />} account={accountForm} />}
  </SafeAreaView></Theme>;
}
function FoundationHome({ snapshot }: { snapshot: Snapshot }) {
  const t=useTheme();
  return <Screen><Row><Logo /><View style={{flex:1}}/><Txt bold>{snapshot.profile.first_name[0]}</Txt></Row><Card><Txt serif size={30}>Your week</Txt><Txt>0 of {snapshot.goals.reduce((n,g)=>n+g.goal,0)} sessions</Txt></Card><Empty title="You're set up." body="Your private account and saved places are ready." /><Txt muted size={12} style={{color:t.muted}}>{snapshot.places.length} saved places</Txt></Screen>;
}
