import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { newDraft, safeMessage, type Draft, type Snapshot,type Place } from "./model";
import { Button, Card, Input, Logo, Screen, Theme, Txt } from "./ui";
import { Onboarding } from "./Onboarding";
import { PlacesPicker } from "./PlacesPicker";
import {Product} from "./Product";
import {Debug} from "./Debug";
import {onSessionsCreated,reconcileTracking,startTracking,stopTracking,syncVisits,trackingState} from "./tracking";
import {announceMilestones,clearNotifications,enableNotifications,notificationResponse,scheduleReminders,testReminder} from "./notifications";
import type {Action} from "./SessionScreens";
import {Friends,AddFriends} from "./Friends";
import {Scanner} from "./Scanner";
import {clipboardSetup,copyInvite,matchContacts,shareInvite,subscribeSocial} from "./social";
import * as Haptics from "expo-haptics";
import {Post,Celebration} from "./Post";
import {syncPhotos} from "./photos";
import {Studios,StudioQR} from "./Studios";
import {demoPlaces} from "./demo-places";
import {Plus} from "./Plus";
import {Health,connectHealth,syncHealth} from "./Health";
import {updateWidget} from "./widgets";
import {track} from "./analytics";

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
  const [authId,setAuthId]=useState<string|null>(null);const [contactMatches,setContactMatches]=useState<{id:string;first_name:string}[]>([]);
  const [studioQR,setStudioQR]=useState<{name:string;code:string}|null>(null);
  const authEpoch=useRef(0);
  const change = (patch: Partial<Draft>) => setDraft(previous => { const value = { ...previous, ...patch }; void write("cs:draft", value).catch(() => {}); return value; });
  const refresh = useCallback(async () => {
    const epoch=authEpoch.current;
    setObservedNow(Date.now());
    if (!configured) return;
    const { data } = await backend().auth.getSession();
    setSignedIn(!!data.session);
    setAuthId(data.session?.user.id??null);
    if (!data.session) { setSnapshot(null);try{updateWidget(null);}catch{}return; }
    try { const value = await getSnapshot();if(epoch!==authEpoch.current)return;setSnapshot(value); await write("cs:snapshot", { auth: data.session.user.id, value:{...value,friends:[],feed:[],inbox:[]} });setClockOffset(await read("cs:clock_offset",0));const state=await trackingState();setTracking(state.paused?"Automatic tracking is paused. Tap to manage.":"");
      try{updateWidget(value);}catch{}void syncHealth(value).catch(()=>{});
      void scheduleReminders(value).catch(()=>{});
      const milestone=await announceMilestones(value).catch(()=>null);if(milestone){setPane('milestone:'+milestone);track('milestone',{count:milestone});}
      const unread=value.inbox.filter(i=>!i.read_at);const previous=await read<string[]>("cs:inbox_seen",[]);if(unread.some(i=>!previous.includes(i.id))){setMessage(`${unread.length} update${unread.length===1?"":"s"} from friends in your inbox.`);await write("cs:inbox_seen",unread.map(i=>i.id));}
    }
    catch (e) {
      if (e instanceof Error && e.message === "SETUP_REQUIRED") return;
      const cached = await read<{ auth: string; value: Snapshot } | null>("cs:snapshot", null);
      if (cached?.auth === data.session.user.id&&epoch===authEpoch.current) setSnapshot(cached.value);
      throw e;
    }
  }, []);
  const run = (action: () => Promise<void>) => { setBusy(true); setMessage(""); void action().catch(e => setMessage(safeMessage(e))).finally(() => setBusy(false)); };
  useEffect(() => {
    void (async () => { const saved=await read("cs:draft", newDraft());if(!await read("cs:clipboard_checked",false)){const codes=await clipboardSetup().catch(()=>undefined);if(codes?.invite_code)saved.invite_code=codes.invite_code;if(codes?.studio_code&&configured){const {data}=await backend().rpc("cs_studio_preview",{code:codes.studio_code});if(data){saved.place={...data,id:""};await write("cs:pending_studio",true);}}await write("cs:clipboard_checked",true);await write("cs:draft",saved);}setDraft(previous=>({...saved,...(previous.invite_code?{invite_code:previous.invite_code}:{}),...(previous.place?{place:previous.place}:{})})); await refresh(); })().catch(e => setMessage(safeMessage(e))).finally(() => setReady(true));
    const foreground=async()=>{await reconcileTracking().catch(()=>{});await syncPhotos().catch(()=>{});await refresh();};
    const app = AppState.addEventListener("change", state => { if (state === "active") void foreground().catch(() => {}); });
    onSessionsCreated(async ids=>{await refresh();if(AppState.currentState==="active"&&ids[0])setPane("session:"+ids[0]);});
    const notification=notificationResponse(setPane);
    const handle = async (url: string) => {
      const parsed = new URL(url); const hash = new URLSearchParams(parsed.hash.slice(1)); const code = parsed.searchParams.get("code");
      if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
        await backend().auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! }); setMode("reset");
      } else if (code && /account/.test(url)) { const { error } = await backend().auth.exchangeCodeForSession(code); if (error) throw error; setMode(parsed.searchParams.get("recovery")==="1"?"reset":"onboarding");await refresh(); }
      else if (/\/j\//.test(parsed.pathname)||parsed.hostname==="j") change({ invite_code: (parsed.hostname==="j"?parsed.pathname.slice(1):parsed.pathname.split("/j/")[1])?.replace(/[^A-Z0-9]/gi, "").slice(0, 12) ?? "" });
      else if (/\/s\//.test(parsed.pathname)||parsed.hostname==="s"){
        const studioCode=parsed.hostname==="s"?parsed.pathname.slice(1):parsed.pathname.split("/s/")[1];const {data,error}=await backend().rpc("cs_studio_preview",{code:studioCode});if(error||!data)throw new Error("That studio link is unavailable.");
        const place={...data,id:undefined} as Place;const {data:auth}=await backend().auth.getSession();
        if(auth.session){await saveSettings("place",place);await refresh();setPane("studios");}else{change({place});await write("cs:pending_studio",true);}
      }
    };
    void Linking.getInitialURL().then(url => url ? handle(url) : undefined).catch(() => {});
    const links = Linking.addEventListener("url", e => { void handle(e.url).catch(e => setMessage(safeMessage(e))); });
    return () => { app.remove(); links.remove();notification.remove();onSessionsCreated(async()=>{}); };
  }, [refresh]);
  const profileId=snapshot?.profile.id;
  useEffect(()=>{if(authId&&profileId)return subscribeSocial(authId,refresh);},[authId,profileId,refresh]);
  useEffect(()=>{if(!profileId)return;let active=true;void (async()=>{if(await read("cs:notification_explained",false)||!active)return;await write("cs:notification_explained",true);Alert.alert("Keep your streak going","Allow reminders for your usual days and newly logged sessions.",[{text:"Not now",style:"cancel"},{text:"Allow reminders",onPress:()=>{void enableNotifications().then(refresh).catch(()=>{});}}]);})();return()=>{active=false;};},[profileId,refresh]);
  const complete = async () => {
    const value = await finishOnboarding(draft);
    setSnapshot(value); await write("cs:draft", newDraft());
    if(draft.invite_code)await call<Snapshot>("cs_social",{action:"invite",payload:{code:draft.invite_code}}).then(setSnapshot).catch(e=>setMessage(safeMessage(e)));
    if(await read("cs:pending_studio",false)){setPane("studios");await write("cs:pending_studio",false);}
    if(draft.location_consent&&value.places.some(p=>p.enabled))await startTracking().catch(()=>setMessage("Your setup is saved. Automatic tracking can be enabled in Account when location is allowed."));
  };
  const signOut=async()=>{authEpoch.current++;try{updateWidget(null);}catch{}await stopTracking();await clearNotifications();await backend().auth.signOut({scope:"local"});await purge();setSnapshot(null);setSignedIn(false);setAuthId(null);setDraft(newDraft());setPane("home");setMode("signin");};
  const action:Action=(name,payload={})=>{
    if(name==="navigate"){setPane(String(payload.pane));if(payload.pane==='plus')track('paywall_viewed',{placement:pane});return;}
    if(name==="post"){setPane("post:"+String(payload.id));return;}
    if(name==="message"){setMessage(String(payload.text));return;}
    if(name==="error"){setMessage(safeMessage(payload.error));return;}
    if(name==="edit_place"){setEditingPlace(String(payload.id));setPane("add-place");return;}
    if(name==="privacy"){setPane("privacy");return;}
    if(name==='delete_account'){Alert.alert('Delete your account?','This permanently removes your account, sessions, photos and friendships. You cannot undo it.',[{text:'Cancel',style:'cancel'},{text:'Delete everything',style:'destructive',onPress:()=>run(async()=>{await stopTracking();const {error}=await backend().functions.invoke('delete_account',{body:{confirm:'DELETE'}});if(error)throw new Error('Deletion has not finished. Please try again to complete it.');await signOut();setMessage('Your account and app data have been deleted.');})}]);return;}
    if(name==="sign_out"){Alert.alert("Sign out?","Saved server sessions stay in your account. Any visits still waiting to sync on this phone will be removed.",[{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress:()=>run(signOut)}]);return;}
    if(name==="reset_onboarding"){run(async()=>{await stopTracking();await write("cs:draft",newDraft());setDraft(newDraft());setSnapshot(null);setPane("home");});return;}
    run(async()=>{
      if(name==="settings"){
        const kind=String(payload.kind);const values=payload.payload as Record<string,unknown>;const editing=["place","disable_place"].includes(kind);const wasActive=editing&&!(await trackingState()).paused;
        if(editing){await syncVisits();await stopTracking();}
        setSnapshot(await saveSettings(kind,values));if(wasActive)await startTracking();
        if(["goals","days"].includes(kind))setMessage(kind==="goals"?"Saved for next Monday.":"Usual days saved.");
      }else if(name==='connect_health'){await connectHealth();await refresh();setMessage('Apple Health matching is enabled.');}
      else if(name==='sync_health'&&snapshot){await syncHealth(snapshot,true);await refresh();setMessage('Matching workouts checked.');}
      else if(name==="edit_session"||name==="remove_session"||name==="manual_session"){
        setSnapshot(await call<Snapshot>("cs_session",{action:name==="edit_session"?"edit":name==="remove_session"?"remove":"manual",payload}));if(name!=="edit_session")setPane("history");
      }else if(name==="start_tracking"){
        await saveSettings("profile",{tracking_consent:true});const fg=await Location.requestForegroundPermissionsAsync();if(fg.granted)await Location.requestBackgroundPermissionsAsync();await startTracking();await refresh();
      }else if(name==="stop_tracking"){await stopTracking();await refresh();}
      else if(name==="rollup"){await call("cs_rollup",{as_of:new Date(Date.now()+await read("cs:clock_offset",0)).toISOString()});await refresh();setMessage("Your weekly totals have been recalculated.");}
      else if(name==="seed_demo"||name==="remove_demo"){await call("cs_seed_demo",{remove_demo:name==="remove_demo",demo_places:name==="seed_demo"?demoPlaces:[]});await refresh();setMessage(name==="seed_demo"?"Demo sessions and three demo friends loaded.":"Demo data removed.");}
      else if(name==="test_reminder")await testReminder();
      else if(name==="enable_notifications"){setMessage(await enableNotifications()?"Phone reminders enabled.":"You can enable notifications in iPhone Settings.");await refresh();}
      else if(name==="timezone"){const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;await saveSettings("timezone",{tz});setMessage(`Timezone ${tz} applies from next Monday.`);}
      else if(name==="social"){setSnapshot(await call<Snapshot>("cs_social",payload));if(payload.action==="reaction")void Haptics.selectionAsync();if(payload.action==="nudge")setMessage("Nudge sent to their ClassStreak inbox.");}
      else if(name==="delete_comment"||name==="report_comment"){setSnapshot(await call<Snapshot>("cs_social",{action:name==="delete_comment"?"delete_comment":"report",payload}));setMessage(name==="delete_comment"?"Comment removed.":"Comment reported.");}
      else if(name==="phone"){await call("cs_contacts",{action:"save",phone:payload.phone});await refresh();setMessage("Phone preference saved.");}
      else if(name==="contacts"){if(!snapshot?.profile.phone_set)throw new Error("Add your phone number in Account first, or use a link, QR or friend code.");const matches=await matchContacts();setContactMatches(matches);if(!matches.length)setMessage("No matches yet. You can still share your invite.");}
      else if(name==="share_invite"&&snapshot)await shareInvite(snapshot.profile.invite_code);
      else if(name==="copy_invite"&&snapshot){await copyInvite(snapshot.profile.invite_code);setMessage("Friend code copied.");}
      else if(name==="studio_qr"&&snapshot){const code=await call<string>("cs_share_studio",{place_id:payload.id});setStudioQR({name:snapshot.places.find(p=>p.id===payload.id)?.name??"Your studio",code});setPane("studio-qr");}
      else if(name==="studio_link"){const {data,error}=await backend().rpc("cs_studio_preview",{code:payload.code});if(error||!data)throw new Error("That studio link is unavailable.");setSnapshot(await saveSettings("place",{...data,id:undefined}));setPane("studios");}
      else throw new Error("This action is not connected yet.");
    });
  };
  const extra=(target:string)=>target==="health"&&snapshot?<Health snapshot={snapshot} action={action}/>:target==="studios"&&snapshot?<Studios snapshot={snapshot} action={action}/>:target==="studio-qr"&&studioQR?<StudioQR {...studioQR} action={action}/>:(target==="recap"||target.startsWith("milestone:"))&&snapshot?<Celebration snapshot={snapshot} action={action} now={new Date(observedNow+clockOffset)} milestone={target.startsWith("milestone:")?Number(target.slice(10)):undefined}/>:target==="friends"&&snapshot?<Friends snapshot={snapshot} action={action} now={new Date(observedNow+clockOffset)}/>:target==="add-friends"&&snapshot?<AddFriends snapshot={snapshot} action={action} matches={contactMatches}/>:target==="scan"?<Scanner action={action}/>:target==="debug"&&snapshot?<Debug snapshot={snapshot} action={action} refresh={refresh}/>:target==="add-place"?<PlacesPicker value={snapshot?.places.find(p=>p.id===editingPlace)??null} onSelect={place=>{action("settings",{kind:"place",payload:{...place,id:place.id||undefined}});setEditingPlace(null);setPane("places");}} onError={e=>setMessage(safeMessage(e))}/>:target==="privacy"?<><Txt serif size={32}>Terms and privacy</Txt><Txt>ClassStreak records visits to the places you save. Location observations and exact visit times are private to your account. Accepted friends see session summaries, photos and comments from the day you became friends.</Txt><Txt>Place names are shared only when both sharing switches are on. Studio boards show first name and last initial when you opt in. You can pause tracking, remove a session, unfriend someone or delete your account.</Txt><Txt>Automatic detection can miss a visit or estimate a departure. A recorded visit does not prove exercise or attendance at a class. Demo and simulated records are labeled.</Txt><Txt>Your account data is stored by Supabase. Google receives studio searches. Photos you export through another app are subject to that app’s audience and policies.</Txt></>:null;
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
    </Screen> : snapshot ? pane==="plus"?<Plus close={()=>setPane("profile")} start={()=>{setMessage("Coming soon");setPane("profile");}}/>:(pane==="post"||pane.startsWith("post:"))?<Post snapshot={snapshot} sessionId={pane.startsWith("post:")?pane.slice(5):undefined} action={action} now={new Date(observedNow+clockOffset)} onSaved={refresh}/>:<Product snapshot={snapshot} pane={pane} action={action} extra={extra} now={new Date(observedNow+clockOffset)} tracking={tracking}/> : <Onboarding draft={draft} change={change} next={() => change({ step: Math.min(9, draft.step + 1) })} requestLocation={() => run(async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status === "granted") await Location.requestBackgroundPermissionsAsync();
      change({ location_consent: fg.status === "granted", step: 6 });
    })} search={<PlacesPicker value={draft.place} onSelect={place => { change({ place, step: 4 }); }} onError={e => setMessage(safeMessage(e))} />} account={accountForm} />}
  </SafeAreaView></Theme>;
}
