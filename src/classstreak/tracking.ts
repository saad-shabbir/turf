import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { read, write, transaction, database } from "../db/local";
import { authenticatedOwner } from "../auth/client";
import { call, getSnapshot } from "./api";
import { activity, type Place, type Source } from "./model";
import { evaluateVisit, distanceMeters, type Candidate, type Fix } from "./engine";
export const TASK = "TURF_GEOFENCE_V1";
export const FIX_TASK = "CLASSSTREAK_FIXES_V1";
type TrackingState = { owner: string | null; token: string | null; paused: boolean; places: Place[]; candidate: Candidate | null; simulated: Candidate | null; outside: string[]; epoch: number };
const initial: TrackingState = { owner: null, token: null, paused: true, places: [], candidate: null, simulated: null, outside: [], epoch: 0 };
export type VisitEvent = { event_id: string; place_id: string; kind: "ENTER" | "EXIT" | "TIMEOUT"; observed_at: string; source: "geofence" | "simulated"; median_speed?: number };
export type TrackingLog = { at: string; kind: string; source: Source; reason: string; place_id?: string };
export const trackingState = () => read("cs:tracking", initial);
let notifying: ((ids: string[]) => Promise<void>) | undefined;
export function onSessionsCreated(handler: (ids: string[]) => Promise<void>) { notifying = handler; }
async function ensureQueue() { await (await database()).execAsync("CREATE TABLE IF NOT EXISTS cs_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,token TEXT,payload TEXT NOT NULL);"); }
let syncing: Promise<void> | undefined;
export function syncVisits() { syncing ??= syncWork().finally(() => { syncing=undefined; });return syncing; }
async function syncWork() {
 await ensureQueue();const owner=await authenticatedOwner();
 for(let batch=0;batch<10;batch++){
  const rows=await (await database()).getAllAsync<{event_id:string;token:string|null;payload:string}>("SELECT event_id,token,payload FROM cs_outbox WHERE owner=? ORDER BY seq LIMIT 40",owner);
  if(!rows.length)return;
  const token=rows[0]!.token;const group=rows.filter(r=>r.token===token);
  const result=await call<{accepted:string[];created:string[]}>("cs_ingest",{events:group.map(r=>JSON.parse(r.payload) as VisitEvent),capture_token:token});
  await transaction(async db=>{const state=await read("cs:tracking",initial,db);if(state.owner!==owner)return;for(const id of result.accepted)await db.runAsync("DELETE FROM cs_outbox WHERE owner=? AND event_id=?",owner,id);await write("cs:last_sync",new Date().toISOString(),db);});
  if(result.created.length&&notifying)await notifying(result.created);
 }
}
export async function receiveEvent(event: VisitEvent, fix?: {lat:number;lng:number}) {
 await ensureQueue();let startFixes=false,stopFixes=false;
 await transaction(async db=>{
  const state=await read("cs:tracking",initial,db);
  if(!state.owner|| (event.source==="geofence"&&state.paused))return;
  if(await db.getFirstAsync("SELECT event_id FROM cs_outbox WHERE event_id=?",event.event_id))return;
  let place=state.places.find(p=>p.id===event.place_id&&p.enabled);if(!place)return;
  if(event.kind==="ENTER"&&fix){const nearest=[...state.places].filter(p=>p.enabled&&distanceMeters(fix,p)<=p.radius_m).sort((a,b)=>distanceMeters(fix,a)-distanceMeters(fix,b))[0];if(nearest)place=nearest;event={...event,place_id:place.id};}
  const key=event.source==="simulated"?"simulated":"candidate";
  let candidate=state[key];let reason="";
  if(event.kind==="ENTER"){
   if(candidate)reason="A visit is already open";
   else if(event.source==="geofence"&&!state.outside.includes(place.id))reason="Initial presence ignored; leave once to establish an arrival";
   else {candidate={place_id:place.id,activity_key:place.activity_key,workout_label:place.last_workout_label??activity(place.activity_key).label,entered_at:event.observed_at,source:event.source,lat:place.lat,lng:place.lng,radius_m:place.radius_m};reason="Visit opened";startFixes=event.source==="geofence";}
  }else{
   if(event.source==="geofence"&&!state.outside.includes(place.id))state.outside.push(place.id);
   if(candidate?.place_id===place.id){
    const fixes=await read<Fix[]>("cs:fixes",[],db);const result=evaluateVisit(candidate,event.observed_at,fixes,event.kind==="TIMEOUT");
    const speeds=fixes.filter(f=>f.timestamp>=Date.parse(candidate!.entered_at)&&f.accuracy!==null&&f.accuracy>=0&&f.accuracy<=100&&f.speed!==null&&f.speed>=0&&distanceMeters({lat:f.latitude,lng:f.longitude},place!)<=place!.radius_m).map(f=>f.speed!).sort((a,b)=>a-b);
    if(speeds.length>=3){const m=Math.floor(speeds.length/2);event.median_speed=speeds.length%2?speeds[m]!:(speeds[m-1]!+speeds[m]!)/2;}
    reason=result.reason;candidate=null;stopFixes=event.source==="geofence";
   }else reason="Outside region";
  }
  await db.runAsync("INSERT OR IGNORE INTO cs_outbox(event_id,owner,token,payload) VALUES(?,?,?,?)",event.event_id,state.owner,event.source==="simulated"?null:state.token,JSON.stringify(event));
  const logs=await read<TrackingLog[]>("cs:logs",[],db);logs.push({at:event.observed_at,kind:event.kind,source:event.source,reason,place_id:place.id});
  await write("cs:logs",logs.slice(-100),db);await write("cs:tracking",{...state,[key]:candidate},db);
 });
 if(startFixes)await Location.startLocationUpdatesAsync(FIX_TASK,{accuracy:Location.Accuracy.Balanced,distanceInterval:100,pausesUpdatesAutomatically:true,showsBackgroundLocationIndicator:true}).catch(()=>{});
 if(stopFixes&&await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);
 await syncVisits().catch(async()=>{await write("cs:sync_error","Your visits are saved on this phone and will retry.");});
}
export async function receiveFixes(locations: Location.LocationObject[]) {
 await transaction(async db=>{const state=await read("cs:tracking",initial,db);if(state.paused||!state.candidate)return;
 const cutoff=Date.now()-2*60*60*1000;const before=await read<Fix[]>("cs:fixes",[],db);
 const fixes=locations.filter(l=>l.coords.accuracy!==null&&l.coords.accuracy>=0&&l.coords.accuracy<=100).map(l=>({timestamp:l.timestamp,latitude:l.coords.latitude,longitude:l.coords.longitude,accuracy:l.coords.accuracy,speed:l.coords.speed}));
 await write("cs:fixes",[...before,...fixes].filter(f=>f.timestamp>=cutoff).slice(-300),db);
 if(fixes.length)await write("cs:last_fix",new Date(fixes[fixes.length-1]!.timestamp).toISOString(),db);
 });
}
export async function stopTracking() {
 const prior=await trackingState();
 await transaction(async db=>{const s=await read("cs:tracking",initial,db);await write("cs:tracking",{...s,paused:true,candidate:null,epoch:s.epoch+1},db);await write("cs:fixes",[],db);});
 if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);
 if(await Location.hasStartedLocationUpdatesAsync(FIX_TASK))await Location.stopLocationUpdatesAsync(FIX_TASK);
 if(prior.token)await call("cs_tracking",{action:"stop",capture_token:prior.token}).catch(()=>{});
}
export async function startTracking() {
 const foreground=await Location.getForegroundPermissionsAsync(),background=await Location.getBackgroundPermissionsAsync();
 if(foreground.status!=="granted"||background.status!=="granted"||!await Location.hasServicesEnabledAsync())throw new Error("PERMISSION_REQUIRED");
 await syncVisits().catch(()=>{});await stopTracking();
 const owner=await authenticatedOwner();const snapshot=await getSnapshot();
 let installation=await read<string|null>("installation",null);if(!installation){installation=Crypto.randomUUID();await write("installation",installation);}
 const device=await call<{token:string}>("cs_tracking",{action:"start",installation});
 const before=await trackingState();const state:TrackingState={owner,token:device.token,paused:false,places:snapshot.places.filter(p=>p.enabled),candidate:null,simulated:before.simulated,outside:[],epoch:before.epoch};
 await write("cs:tracking",state);
 try{await Location.startGeofencingAsync(TASK,state.places.map(p=>({identifier:p.id,latitude:p.lat,longitude:p.lng,radius:p.radius_m,notifyOnEnter:true,notifyOnExit:true})));}
 catch(e){await stopTracking();throw e;}
 if((await trackingState()).epoch!==state.epoch)await Location.stopGeofencingAsync(TASK);
}
export async function reconcileTracking() {
 const state=await trackingState();if(state.paused){if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);return;}
 const permission=await Location.getBackgroundPermissionsAsync();
 if(permission.status!=="granted"||!await Location.hasServicesEnabledAsync()){await stopTracking();return;}
 if(state.candidate&&Date.now()-Date.parse(state.candidate.entered_at)>=14400000)await receiveEvent({event_id:Crypto.randomUUID(),place_id:state.candidate.place_id,kind:"TIMEOUT",source:"geofence",observed_at:new Date(Date.parse(state.candidate.entered_at)+14400000).toISOString()});
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
