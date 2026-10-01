import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { read, write, transaction, database } from "../db/local";
import { authenticatedOwner } from "../auth/client";
import { call, getSnapshot } from "./api";
import { activity, type Place, type Source,type Snapshot } from "./model";
import { evaluateVisit, distanceMeters,retainedVisitFixes, type Candidate, type Fix } from "./engine";
import {notifyPendingVisit,notifySession,notifyArrival} from "./notifications";
import {captureHoldReason,type CaptureStatus} from "./syncRecovery";
import {observeDeparture,type DepartureEvidence} from './departureRecovery';
import {track} from './analytics';
import {syncWorkoutLiveActivity} from './workoutLiveActivity';
export const TASK = "TURF_GEOFENCE_V1";
export const FIX_TASK = "CLASSSTREAK_FIXES_V1";
type TrackingState = { owner: string | null; token: string | null; paused: boolean; places: Place[]; candidate: Candidate | null; simulated: Candidate | null; outside: string[]; epoch: number; departure?: DepartureEvidence | null; next_places?:Place[]; boundary_exit_at?:string|null };
const initial: TrackingState = { owner: null, token: null, paused: true, places: [], candidate: null, simulated: null, outside: [], epoch: 0 };
export type VisitEvent = { event_id: string; place_id: string; kind: "ENTER" | "EXIT" | "TIMEOUT" | "SELECT" | "RESTART" | "STOP"; visit_id?: string; activity_key?: string; observed_at: string; source: "geofence" | "simulated"; median_speed?: number; recovered?: boolean; workout_started_at?: string };
type CaptureIdentity = Pick<TrackingState,'owner'|'token'|'epoch'>;
const sameCapture=(state:TrackingState,expected:CaptureIdentity)=>state.owner===expected.owner&&state.token===expected.token&&state.epoch===expected.epoch;
const fixOptions=()=>({accuracy:Location.Accuracy.Balanced,distanceInterval:25,pausesUpdatesAutomatically:false,showsBackgroundLocationIndicator:true});
export type TrackingLog = { at: string; kind: string; source: Source; reason: string; place_id?: string };
export const trackingState = () => read("cs:tracking", initial);
let notifying: ((ids: string[]) => Promise<void>) | undefined;
export function onSessionsCreated(handler: (ids: string[]) => Promise<void>) { notifying = handler; }
async function ensureQueue() { await (await database()).execAsync("CREATE TABLE IF NOT EXISTS cs_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,token TEXT,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cs_outbox_holds(event_id TEXT PRIMARY KEY,owner TEXT NOT NULL,reason TEXT NOT NULL);"); }
let syncing: Promise<void> | undefined;
export function syncVisits() { syncing ??= syncWork().catch(async error=>{await write("cs:sync_error",error instanceof Error?error.message:"NETWORK");throw error;}).finally(() => { syncing=undefined; });return syncing; }
async function syncWork() {
 await ensureQueue();const owner=await authenticatedOwner();
 for(let batch=0;batch<10;batch++){
  const rows=await (await database()).getAllAsync<{event_id:string;token:string|null;payload:string}>("SELECT event_id,token,payload FROM cs_outbox WHERE owner=? AND NOT EXISTS(SELECT 1 FROM cs_outbox_holds h WHERE h.event_id=cs_outbox.event_id AND h.owner=cs_outbox.owner) ORDER BY seq LIMIT 40",owner);
  if(!rows.length){await write("cs:sync_error","");return;}
  const token=rows[0]!.token;const boundary=rows.findIndex(r=>r.token!==token);const group=boundary<0?rows:rows.slice(0,boundary);
  let result:{accepted:string[];created:string[]};
  try{result=await call("cs_ingest",{events:group.map(r=>JSON.parse(r.payload) as VisitEvent),capture_token:token});}
  catch(error){
   if(!(error instanceof Error)||error.message!=="CAPTURE_EXPIRED")throw error;
   const status=await call<CaptureStatus>("cs_capture_status",{capture_token:token});
   const held=group.map(row=>({row,reason:captureHoldReason(JSON.parse(row.payload),status)})).filter(item=>item.reason);
   if(!held.length)throw error; // Future clocks/network errors stay retryable; no evidence is discarded.
   await transaction(async db=>{
    if((await read("cs:tracking",initial,db)).owner!==owner)throw new Error("AUTH_REQUIRED");
    for(const {row,reason} of held)await db.runAsync("INSERT OR IGNORE INTO cs_outbox_holds(event_id,owner,reason) VALUES(?,?,?)",row.event_id,owner,reason);
   });
   continue;
  }
  await transaction(async db=>{const state=await read("cs:tracking",initial,db);if(state.owner!==owner)return;for(const id of result.accepted)await db.runAsync("DELETE FROM cs_outbox WHERE owner=? AND event_id=?",owner,id);await write("cs:last_sync",new Date().toISOString(),db);});
  if(result.created.length){const s=await getSnapshot();for(const session of s.sessions.filter(s=>result.created.includes(s.id)))track('session_logged',{activity:session.activity_key,duration:session.duration_sec,counted:session.counted,source:session.source});await notifySession(result.created).catch(()=>{});if(notifying)await notifying(result.created);}
 }
}
export async function receiveEvent(event: VisitEvent, fix?: {lat:number;lng:number}, expected?:CaptureIdentity) {
 await ensureQueue();let startFixes=false,stopFixes=false,qualified=false,refreshRegions=false,confirmExit=false;let arrival:Place|undefined;
 await transaction(async db=>{
  const state=await read("cs:tracking",initial,db);
  if(expected&&!sameCapture(state,expected))return;
  if(!state.owner|| (event.source==="geofence"&&state.paused))return;
  if(await db.getFirstAsync("SELECT event_id FROM cs_outbox WHERE event_id=?",event.event_id))return;
  let place=state.places.find(p=>p.id===event.place_id&&p.enabled);if(!place)return;
  if(event.kind==="ENTER"&&fix){const nearest=[...state.places].filter(p=>p.enabled&&distanceMeters(fix,p)<=p.radius_m).sort((a,b)=>distanceMeters(fix,a)-distanceMeters(fix,b))[0];if(nearest)place=nearest;event={...event,place_id:place.id};}
  const key=event.source==="simulated"?"simulated":"candidate";
  let candidate=state[key];let reason="";
  if(event.recovered&&(!candidate||candidate.visit_id!==event.visit_id||candidate.entered_at!==event.workout_started_at))return;
  // Native region exits can be indoor GPS drift. Keep the durable arrival and
  // timer until the independent fresh-fix confirmation observes departure.
  if(event.source==='geofence'&&event.kind==='EXIT'&&!event.recovered&&candidate?.place_id===place.id){
   if(!Number.isFinite(Date.parse(event.observed_at))||Date.parse(event.observed_at)<Date.parse(candidate.entered_at))return;
   confirmExit=true;
   if(!state.boundary_exit_at){
    const logs=await read<TrackingLog[]>('cs:logs',[],db);
    logs.push({at:event.observed_at,kind:'EXIT_CHECK',source:'geofence',reason:'Boundary exit received; workout kept open until departure is confirmed',place_id:place.id});
    await write('cs:logs',logs.slice(-100),db);
    await write('cs:tracking',{...state,boundary_exit_at:event.observed_at},db);
   }
   await write('cs:last_callback',event.observed_at,db);
   return;
  }
  if(event.source==='geofence'&&event.kind==='ENTER'&&candidate?.place_id===place.id){state.boundary_exit_at=null;state.departure=null;}

  if(["SELECT","RESTART","STOP"].includes(event.kind)){
   if(event.source!=="geofence"||!candidate||candidate.visit_id!==event.visit_id||candidate.place_id!==place.id)return;
   if(Date.parse(event.observed_at)<Date.parse(candidate.entered_at))throw new Error("Your phone clock changed. Please try again.");
   if(event.kind==="SELECT"){const chosen=activity(event.activity_key??"");if(chosen.key!==event.activity_key)throw new Error("Choose a workout type.");candidate={...candidate,activity_key:chosen.key,workout_label:chosen.label};}
   else if(event.kind==="RESTART"){candidate={...candidate,entered_at:event.observed_at};state.departure=null;state.boundary_exit_at=null;await write("cs:fixes",[],db);}
   else {candidate=null;stopFixes=true;qualified=true;state.outside=state.outside.filter(id=>id!==place.id);await write("cs:workout_saved",event.event_id,db);}
  }else if(event.kind==="ENTER"){
   if(candidate)reason="A visit is already open";
   else if(event.source==="geofence"&&!state.outside.includes(place.id))reason="Initial presence ignored; leave once to establish an arrival";
   else {candidate={visit_id:event.event_id,place_id:place.id,activity_key:place.activity_key,workout_label:place.last_workout_label??activity(place.activity_key).label,entered_at:event.observed_at,source:event.source,lat:place.lat,lng:place.lng,radius_m:place.radius_m};reason="Visit opened";startFixes=event.source==="geofence";if(startFixes){arrival=place;state.outside=state.outside.filter(id=>id!==place.id);await write("cs:fixes",[],db);}}
  }else{
   if(event.source==="geofence"&&!state.outside.includes(place.id))state.outside.push(place.id);
   if(candidate?.place_id===place.id){
    const fixes=event.source==="simulated"?[]:await read<Fix[]>("cs:fixes",[],db);const result=evaluateVisit(candidate,event.observed_at,fixes,event.kind==="TIMEOUT"||event.recovered===true);
    qualified=result.qualifies;
    const speeds=fixes.filter(f=>f.timestamp>=Date.parse(candidate!.entered_at)&&f.timestamp<=Date.parse(event.observed_at)&&f.accuracy!==null&&f.accuracy>=0&&f.accuracy<=100&&f.speed!==null&&f.speed>=0&&distanceMeters({lat:f.latitude,lng:f.longitude},place!)<=place!.radius_m).map(f=>f.speed!).sort((a,b)=>a-b);
    if(speeds.length>=3){const m=Math.floor(speeds.length/2);event.median_speed=speeds.length%2?speeds[m]!:(speeds[m-1]!+speeds[m]!)/2;}
    reason=event.recovered?`${result.reason} · departure recovered from location`:result.reason;candidate=null;stopFixes=event.source==="geofence";
   }else reason="Outside region";
  }
  if(event.source==='geofence'&&(!candidate||startFixes)){state.departure=null;state.boundary_exit_at=null;}
  if(event.source==='geofence'&&!candidate&&state.next_places){state.places=state.next_places;delete state.next_places;refreshRegions=true;}
  await db.runAsync("INSERT OR IGNORE INTO cs_outbox(event_id,owner,token,payload) VALUES(?,?,?,?)",event.event_id,state.owner,event.source==="simulated"?null:state.token,JSON.stringify(event));
  const logs=await read<TrackingLog[]>("cs:logs",[],db);logs.push({at:event.observed_at,kind:event.kind,source:event.source,reason,place_id:place.id});
  await write("cs:logs",logs.slice(-100),db);await write("cs:tracking",{...state,[key]:candidate},db);if(event.source==='geofence')await write('cs:last_callback',event.observed_at,db);
 });
 await syncWorkoutLiveActivity().catch(()=>{});
 if(arrival)await notifyArrival(arrival.name,event.event_id).catch(()=>{});
 if(startFixes||confirmExit)await ensureVisitFixes().catch(()=>write('cs:task_error','Arrival saved, but backup location updates could not start. Open the app to check tracking.'));
 if(stopFixes&&await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);
 if(refreshRegions){const state=await trackingState();if(!state.paused)await registerRegions(state).catch(()=>{});}
 await syncVisits().catch(async()=>{if(qualified)await notifyPendingVisit(event.event_id).catch(()=>{});});
}
export async function receiveFixes(locations: Location.LocationObject[], expected?:CaptureIdentity) {
 let departure:{event:VisitEvent;capture:CaptureIdentity}|undefined;
 await transaction(async db=>{const state=await read("cs:tracking",initial,db);if(state.paused||!state.candidate||!state.owner||expected&&!sameCapture(state,expected))return;
 const before=await read<Fix[]>("cs:fixes",[],db);
 const observed=locations.map(l=>({timestamp:l.timestamp,latitude:l.coords.latitude,longitude:l.coords.longitude,accuracy:l.coords.accuracy,speed:l.coords.speed}));
 const recovery=observeDeparture(state.candidate,observed,state.departure??null,Date.now());
 await write('cs:tracking',{...state,departure:recovery.evidence},db);
 const fixes=retainedVisitFixes(observed,state.candidate,Date.now());
 await write("cs:fixes",retainedVisitFixes([...before,...fixes],state.candidate,Date.now()),db);
 const valid=observed.filter(f=>Number.isFinite(f.timestamp)&&f.timestamp<=Date.now()&&f.timestamp>=Date.now()-120000&&f.accuracy!==null&&f.accuracy>=0&&f.accuracy<=100).sort((a,b)=>a.timestamp-b.timestamp);
 if(valid.length)await write("cs:last_fix",new Date(valid[valid.length-1]!.timestamp).toISOString(),db);
 if(recovery.exitedAt&&state.candidate.visit_id)departure={capture:{owner:state.owner,token:state.token,epoch:state.epoch},event:{event_id:Crypto.randomUUID(),place_id:state.candidate.place_id,kind:'EXIT',source:'geofence',observed_at:recovery.exitedAt,recovered:true,visit_id:state.candidate.visit_id,workout_started_at:state.candidate.entered_at}};
 });
 // The event and candidate change remain atomic in receiveEvent; a concurrent
 // Stop, Restart, account switch or later arrival wins over this stale evidence.
 if(departure)await receiveEvent(departure.event,undefined,departure.capture);
}
async function ensureVisitFixes(){
 const state=await trackingState();if(state.paused||!state.candidate)return;
 await Location.startLocationUpdatesAsync(FIX_TASK,fixOptions());
 const after=await trackingState();if(after.paused||!after.candidate){
  if(await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);
 }
}
async function registerRegions(state:TrackingState,attempt=0):Promise<void>{
 await Location.startGeofencingAsync(TASK,state.places.filter(p=>p.enabled).map(p=>({identifier:p.id,latitude:p.lat,longitude:p.lng,radius:p.radius_m,notifyOnEnter:true,notifyOnExit:true})));
 const current=await trackingState();
 if(current.paused)await Location.stopGeofencingAsync(TASK);
 else if(!sameCapture(current,state)&&attempt<2)await registerRegions(current,attempt+1);
}
export async function stopTracking() {
 let token:string|null=null;
 await transaction(async db=>{const s=await read("cs:tracking",initial,db);token=s.token;await write("cs:tracking",{...s,paused:true,candidate:null,departure:null,boundary_exit_at:null,epoch:s.epoch+1},db);await write("cs:fixes",[],db);});
 await syncWorkoutLiveActivity().catch(()=>{});
 if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);
 if(await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);
 if(token)await call("cs_tracking",{action:"stop",capture_token:token}).catch(()=>{});
}
export async function startTracking() {
 const foreground=await Location.getForegroundPermissionsAsync(),background=await Location.getBackgroundPermissionsAsync();
 if(foreground.status!=="granted"||background.status!=="granted"||!await Location.hasServicesEnabledAsync())throw new Error("PERMISSION_REQUIRED");
 const owner=await authenticatedOwner();const active=await trackingState();
 if(!active.paused&&active.owner===owner&&active.token){
  // Re-registering regions is a repair, not a new capture. Keep an in-progress
  // arrival, its original capture token and offline evidence intact.
  const snapshot=await getSnapshot().catch(()=>null);
  let repaired:TrackingState|undefined;
  await transaction(async db=>{const current=await read('cs:tracking',initial,db);if(current.paused||!sameCapture(current,active))return;
   const requested=snapshot?snapshot.places.filter(p=>p.enabled):(current.next_places??current.places);
   const places=[...requested];
   const ongoing=current.candidate&&current.places.find(p=>p.id===current.candidate!.place_id);
   if(ongoing){const index=places.findIndex(p=>p.id===ongoing.id);if(index<0)places.push(ongoing);else places[index]=ongoing;}
   repaired={...current,places,next_places:ongoing?requested:undefined};await write('cs:tracking',repaired,db);
  });
  if(repaired){await registerRegions(repaired);await ensureVisitFixes();await syncVisits().catch(()=>{});}
  return;
 }
 // Do not revoke a stopped capture while its offline evidence is still queued.
 await syncVisits();await stopTracking();
 const before=await trackingState();
 const snapshot=await getSnapshot();
 let installation=await read<string|null>("installation",null);if(!installation){installation=Crypto.randomUUID();await write("installation",installation);}
 const device=await call<{token:string}>("cs_tracking",{action:"start",installation});
 const state:TrackingState={owner,token:device.token,paused:false,places:snapshot.places.filter(p=>p.enabled),candidate:null,simulated:before.simulated,outside:[],epoch:before.epoch};
 let installed=false;
 await transaction(async db=>{const current=await read('cs:tracking',initial,db);if(!current.paused||!sameCapture(current,before))return;await write('cs:tracking',state,db);installed=true;});
 if(!installed){await call('cs_tracking',{action:'stop',capture_token:device.token}).catch(()=>{});return;}
 await write('cs:started_at',new Date().toISOString());
 try{await registerRegions(state);}
 catch(e){if(sameCapture(await trackingState(),state))await stopTracking();throw e;}
}
export async function reconcileTracking() {
 await syncWorkoutLiveActivity().catch(()=>{});
 const state=await trackingState();if(state.paused){if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);if(await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);return;}
 const permission=await Location.getBackgroundPermissionsAsync();
 if(permission.status!=="granted"||!await Location.hasServicesEnabledAsync()){await stopTracking();return;}
 if(!await Location.hasStartedGeofencingAsync(TASK))await registerRegions(state);
 if(state.candidate){
  await ensureVisitFixes().catch(()=>write('cs:task_error','Backup location updates could not start. Check your location settings.'));
  const cached=await Location.getLastKnownPositionAsync({maxAge:120000,requiredAccuracy:100}).catch(()=>null);
  if(cached)await receiveFixes([cached],state);
  // The cached position may precede the departure. A fresh foreground reading
  // can confirm it; never use reopening the app itself as the end timestamp.
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const fresh=await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}).catch(()=>null),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),8000);})]);if(fresh)await receiveFixes([fresh],state);}
  finally{if(timer)clearTimeout(timer);}
 }
 const after=await trackingState();
 if(sameCapture(after,state)&&after.candidate&&Date.now()-Date.parse(after.candidate.entered_at)>=14400000)await receiveEvent({event_id:Crypto.randomUUID(),place_id:after.candidate.place_id,kind:"TIMEOUT",source:"geofence",observed_at:new Date(Date.parse(after.candidate.entered_at)+14400000).toISOString()},undefined,state);
 await syncVisits().catch(()=>{});
}
export async function simulate(kind: "ENTER"|"EXIT"|"LATER"|"DRIVE",place:Place,clockOffset=0) {
 const owner=await authenticatedOwner();const snapshot=await getSnapshot();
 await transaction(async db=>{const s=await read("cs:tracking",initial,db);await write("cs:tracking",{...s,owner,places:snapshot.places},db);});
 const now=Date.now()+clockOffset;let current=await trackingState();
 const send=async(k:"ENTER"|"EXIT",at:number)=>receiveEvent({event_id:Crypto.randomUUID(),place_id:place.id,kind:k,source:"simulated",observed_at:new Date(at).toISOString()});
 if(kind==="DRIVE"){await send("ENTER",now);await send("EXIT",now+120000);}
 else if(kind==="ENTER")await send("ENTER",now);
 else{current=await trackingState();const start=current.simulated?Date.parse(current.simulated.entered_at):now;await send("EXIT",kind==="LATER"?start+2400000:now);}
}
let warningDay='';
export async function trackingNotice(snapshot:Snapshot){
 const state=await trackingState();const permission=await Location.getBackgroundPermissionsAsync();
 if(permission.status!=='granted')return 'Sessions only count while the app is open — turn on Always in Settings.';
 if(!await Location.hasServicesEnabledAsync())return 'Location is turned off. Open Settings to count your sessions.';
 if(state.paused)return 'Automatic tracking is paused. Tap to manage.';
 const now=new Date();const day=new Intl.DateTimeFormat('en-CA',{timeZone:snapshot.profile.tz}).format(now);const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:snapshot.profile.tz,hour:'numeric',hourCycle:'h23'}).format(now));
 const last=await read('cs:last_fix',await read('cs:started_at',now.toISOString()));
 if(hour>=7&&hour<23&&now.getTime()-Date.parse(last)>6*3600000){
  if(warningDay===day)return 'Tracking may be off. Tap to check your location settings.';
  if(await read('cs:tracking_warning_day','')!==day){warningDay=day;await write('cs:tracking_warning_day',day);return 'Tracking may be off. Tap to check your location settings.';}
 }
 return '';
}

export async function controlWorkout(kind:"SELECT"|"RESTART"|"STOP",visitId:string,activityKey?:string){
 const state=await trackingState();const c=state.candidate;
 if(!c||c.visit_id!==visitId||state.paused)throw new Error("This workout has already ended.");
 await receiveEvent({event_id:Crypto.randomUUID(),visit_id:visitId,place_id:c.place_id,kind,activity_key:activityKey,source:"geofence",observed_at:new Date().toISOString()});
}
