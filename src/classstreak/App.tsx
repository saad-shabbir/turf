import React, { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { backend, configured } from "../auth/client";
import { purge, read, write } from "../db/local";
import { call, finishOnboarding, getSnapshot, resetEmail, saveSettings, signIn, signUp } from "./api";
import { newDraft, safeMessage, type Draft, type Snapshot } from "./model";
import { Button, Card, Input, Logo, Screen, Theme, Txt } from "./ui";
import { Onboarding } from "./Onboarding";
import { PlacesPicker } from "./PlacesPicker";
import {Product} from "./Product";
import {Debug} from "./Debug";
import {onSessionsCreated,reconcileTracking,startTracking,stopTracking,syncVisits,trackingState} from "./tracking";
import {clearNotifications,enableNotifications,notificationResponse,testReminder} from "./notifications";
import type {Action} from "./SessionScreens";

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
  const [pane,setPane]=useState("home");const [clockOffset,setClockOffset]=useState(0);const [tracking,setTracking]=useState("");
  const [observedNow,setObservedNow]=useState(()=>Date.now());
  const [editingPlace,setEditingPlace]=useState<string|null>(null);
  const change = (patch: Partial<Draft>) => setDraft(previous => { const value = { ...previous, ...patch }; void write("cs:draft", value).catch(() => {}); return value; });
  const refresh = useCallback(async () => {
    setObservedNow(Date.now());
    if (!configured) return;
    const { data } = await backend().auth.getSession();
    setSignedIn(!!data.session);
    if (!data.session) { setSnapshot(null); return; }
    try { const value = await getSnapshot(); setSnapshot(value); await write("cs:snapshot", { auth: data.session.user.id, value });setClockOffset(await read("cs:clock_offset",0));const state=await trackingState();setTracking(state.paused?"Automatic tracking is paused. Tap to manage.":""); }
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
    const foreground=async()=>{await reconcileTracking().catch(()=>{});await refresh();};
    const app = AppState.addEventListener("change", state => { if (state === "active") void foreground().catch(() => {}); });
    onSessionsCreated(async ids=>{await refresh();if(AppState.currentState==="active"&&ids[0])setPane("session:"+ids[0]);});
    const notification=notificationResponse(setPane);
    const handle = async (url: string) => {
      const parsed = new URL(url); const hash = new URLSearchParams(parsed.hash.slice(1)); const code = parsed.searchParams.get("code");
      if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
        await backend().auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! }); setMode("reset");
      } else if (code && /account/.test(url)) { const { error } = await backend().auth.exchangeCodeForSession(code); if (error) throw error; setMode(parsed.searchParams.get("recovery")==="1"?"reset":"onboarding");await refresh(); }
      else if (/\/j\//.test(parsed.pathname)||parsed.hostname==="j") change({ invite_code: (parsed.hostname==="j"?parsed.pathname.slice(1):parsed.pathname.split("/j/")[1])?.replace(/[^A-Z0-9]/gi, "").slice(0, 12) ?? "" });
    };
    void Linking.getInitialURL().then(url => url ? handle(url) : undefined).catch(() => {});
    const links = Linking.addEventListener("url", e => { void handle(e.url).catch(e => setMessage(safeMessage(e))); });
    return () => { app.remove(); links.remove();notification.remove();onSessionsCreated(async()=>{}); };
  }, [refresh]);
  const complete = async () => {
    const value = await finishOnboarding(draft);
    setSnapshot(value); await write("cs:draft", newDraft());
    if(draft.location_consent&&value.places.some(p=>p.enabled))await startTracking().catch(()=>setMessage("Your setup is saved. Automatic tracking can be enabled in Account when location is allowed."));
  };
  const signOut=async()=>{await stopTracking();await clearNotifications();await backend().auth.signOut({scope:"local"});await purge();setSnapshot(null);setSignedIn(false);setDraft(newDraft());setPane("home");setMode("signin");};
  const action:Action=(name,payload={})=>{
    if(name==="navigate"){setPane(String(payload.pane));return;}
    if(name==="post"){setPane("post:"+String(payload.id));return;}
    if(name==="message"){setMessage(String(payload.text));return;}
    if(name==="error"){setMessage(safeMessage(payload.error));return;}
    if(name==="edit_place"){setEditingPlace(String(payload.id));setPane("add-place");return;}
    if(name==="privacy"){setPane("privacy");return;}
    if(name==="sign_out"){Alert.alert("Sign out?","Saved server sessions stay in your account. Any visits still waiting to sync on this phone will be removed.",[{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress:()=>run(signOut)}]);return;}
    if(name==="reset_onboarding"){run(async()=>{await stopTracking();await write("cs:draft",newDraft());setDraft(newDraft());setSnapshot(null);setPane("home");});return;}
    run(async()=>{
      if(name==="settings"){
        const kind=String(payload.kind);const values=payload.payload as Record<string,unknown>;const editing=["place","disable_place"].includes(kind);const wasActive=editing&&!(await trackingState()).paused;
        if(editing){await syncVisits();await stopTracking();}
        setSnapshot(await saveSettings(kind,values));if(wasActive)await startTracking();
        if(["goals","days"].includes(kind))setMessage(kind==="goals"?"Saved for next Monday.":"Usual days saved.");
      }else if(name==="edit_session"||name==="remove_session"||name==="manual_session"){
        setSnapshot(await call<Snapshot>("cs_session",{action:name==="edit_session"?"edit":name==="remove_session"?"remove":"manual",payload}));if(name!=="edit_session")setPane("history");
      }else if(name==="start_tracking"){
        await saveSettings("profile",{tracking_consent:true});const fg=await Location.requestForegroundPermissionsAsync();if(fg.granted)await Location.requestBackgroundPermissionsAsync();await startTracking();await refresh();
      }else if(name==="stop_tracking"){await stopTracking();await refresh();}
      else if(name==="rollup"){await call("cs_rollup",{as_of:new Date(Date.now()+await read("cs:clock_offset",0)).toISOString()});await refresh();setMessage("Your weekly totals have been recalculated.");}
      else if(name==="seed_demo"||name==="remove_demo"){await call("cs_seed_demo",{remove_demo:name==="remove_demo"});await refresh();setMessage(name==="seed_demo"?"Demo sessions and three demo friends loaded.":"Demo data removed.");}
      else if(name==="test_reminder")await testReminder();
      else if(name==="enable_notifications")setMessage(await enableNotifications()?"Phone reminders enabled.":"You can enable notifications in iPhone Settings.");
      else if(name==="timezone"){const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;await saveSettings("timezone",{tz});setMessage(`Timezone ${tz} applies from next Monday.`);}
      else throw new Error("This action is not connected yet.");
    });
  };
  const extra=(target:string)=>target==="debug"&&snapshot?<Debug snapshot={snapshot} action={action} refresh={refresh}/>:target==="add-place"?<PlacesPicker value={snapshot?.places.find(p=>p.id===editingPlace)??null} onSelect={place=>{action("settings",{kind:"place",payload:{...place,id:place.id||undefined}});setEditingPlace(null);setPane("places");}} onError={e=>setMessage(safeMessage(e))}/>:target==="privacy"?<><Txt serif size={32}>Terms and privacy</Txt><Txt>ClassStreak records visits to the places you save. Location observations and exact visit times are private to your account. Accepted friends see session summaries, photos and comments from the day you became friends.</Txt><Txt>Place names are shared only when both sharing switches are on. Studio boards show first name and last initial when you opt in. You can pause tracking, remove a session, unfriend someone or delete your account.</Txt><Txt>Automatic detection can miss a visit or estimate a departure. A recorded visit does not prove exercise or attendance at a class. Demo and simulated records are labeled.</Txt><Txt>Your account data is stored by Supabase. Google receives studio searches. Photos you export through another app are subject to that app’s audience and policies.</Txt></>:null;
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
    <Pressable onPress={()=>setPane("privacy")}><Txt size={11} muted style={{ textAlign: "center" }}>By continuing you agree to the Terms and Privacy Policy.</Txt></Pressable>
  </View>;
  return <Theme name={snapshot?.profile.theme ?? draft.theme}><SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
    {!!message && <Card style={{ borderRadius: 0, padding: 10 }}><Pressable accessibilityLabel="Dismiss message" onPress={() => setMessage("")}><Txt size={12}>{message}</Txt></Pressable></Card>}
    {!ready || !fontsLoaded ? <Screen><Logo /><Txt muted>Opening your streak…</Txt></Screen> : pane==="privacy"&&!snapshot?<Screen>{extra("privacy")}<Button title="Back" onPress={()=>setPane("home")}/></Screen>:mode !== "onboarding" ? <Screen><Logo /><Txt serif size={35}>{mode === "signin" ? "Welcome back." : mode === "forgot" ? "Forgot password?" : "Choose a new password."}</Txt>
      {mode !== "reset" && <Input label="Email" value={email} onChange={setEmail} keyboard="email-address" />}
      {mode !== "forgot" && <Input label="Password" value={password} onChange={setPassword} secure />}
      <Button title={busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Save password"} disabled={busy} onPress={() => run(async () => {
        if (mode === "signin") { await signIn(email, password); setPassword(""); await refresh(); setMode("onboarding"); }
        else if (mode === "forgot") { await resetEmail(email); setMessage("If an account exists, a reset link will arrive by email."); }
        else { const { error } = await backend().auth.updateUser({ password }); if (error) throw error; setPassword(""); setMode("onboarding"); await refresh(); }
      })} />
      {mode === "signin" && <Button secondary title="Forgot password" onPress={() => setMode("forgot")} />}
      <Button secondary title="Back" onPress={() => setMode("onboarding")} />
    </Screen> : snapshot ? <Product snapshot={snapshot} pane={pane} action={action} extra={extra} now={new Date(observedNow+clockOffset)} tracking={tracking}/> : <Onboarding draft={draft} change={change} next={() => change({ step: Math.min(9, draft.step + 1) })} requestLocation={() => run(async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status === "granted") await Location.requestBackgroundPermissionsAsync();
      change({ location_consent: fg.status === "granted", step: 6 });
    })} search={<PlacesPicker value={draft.place} onSelect={place => { change({ place, step: 4 }); }} onError={e => setMessage(safeMessage(e))} />} account={accountForm} />}
  </SafeAreaView></Theme>;
}
