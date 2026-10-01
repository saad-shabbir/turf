import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import {authenticatedOwner} from '../auth/client';
import {read,write,transaction} from '../db/local';
import {activity,type Snapshot} from './model';
import {distanceMeters,type Candidate} from './engine';
import {call} from './api';
import {trackingState,controlWorkout} from './tracking';
import {syncWorkoutLiveActivity} from './workoutLiveActivity';
export type ButtonWorkout={owner:string;candidate:Candidate;ended_at?:string};
export const buttonWorkout=()=>read<ButtonWorkout|null>('cs:button_workout',null);
export function startingPlace(places:Snapshot['places'],fix:Location.LocationObject,now=Date.now()){
 const c=fix.coords;
 if(!Number.isFinite(fix.timestamp)||fix.timestamp>now||now-fix.timestamp>30000||c.accuracy===null||!Number.isFinite(c.accuracy)||c.accuracy<0||c.accuracy>100||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))throw new Error('Couldn’t confirm your location. Try again near your saved gym or studio.');
 const place=places.filter(p=>p.enabled&&distanceMeters({lat:c.latitude,lng:c.longitude},p)+c.accuracy!<=p.radius_m).sort((a,b)=>distanceMeters({lat:c.latitude,lng:c.longitude},a)-distanceMeters({lat:c.latitude,lng:c.longitude},b))[0];
 if(!place)throw new Error('You need to be at a saved gym or studio to start this workout.');
 return place;
}
let starting:Promise<Candidate>|undefined;
export function startButtonWorkout(s:Snapshot,key:string){starting??=start(s,key).finally(()=>{starting=undefined;});return starting;}
async function start(s:Snapshot,key:string){
 const owner=await authenticatedOwner(),epoch=await read('auth_epoch',0);const cache=await read<{auth:string;value:Snapshot}|null>('cs:snapshot',null);if(cache?.auth!==owner||cache.value.profile.id!==s.profile.id)throw new Error('AUTH_REQUIRED');
 const current=await trackingState();const existing=await buttonWorkout();
 if(existing?.owner===owner)return existing.candidate;
 if(current.owner===owner&&!current.paused&&current.candidate){await controlWorkout('SELECT',current.candidate.visit_id!,key);return (await trackingState()).candidate!;}
 const chosen=activity(key);if(chosen.key!==key)throw new Error('Choose a workout type.');
 const permission=await Location.getForegroundPermissionsAsync();const enabled=await Location.hasServicesEnabledAsync();
 let place:Snapshot['places'][number]|undefined;
 if(enabled&&permission.status==='granted'){
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{const fix=await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Couldn’t confirm your location. Try again near your saved gym or studio.')),12000);})]);place=startingPlace(s.places,fix);}
  finally{if(timeout)clearTimeout(timeout);}
 }
 // A lookup failure never falls back to location-off mode.
 const candidate:Candidate={visit_id:Crypto.randomUUID(),place_id:place?.id??'',activity_key:chosen.key,workout_label:chosen.label,entered_at:new Date().toISOString(),source:'manual',lat:0,lng:0,radius_m:0};
 let result=candidate;
 await transaction(async db=>{
  if(await read('auth_blocked',false,db)||await read('auth_epoch',0,db)!==epoch)throw new Error('AUTH_REQUIRED');
  const active=await read<ButtonWorkout|null>('cs:button_workout',null,db);const auto=await read<{owner:string;paused:boolean;candidate:Candidate|null}|null>('cs:tracking',null,db);
  if(active?.owner===owner){result=active.candidate;return;}
  if(auto?.owner===owner&&!auto.paused&&auto.candidate){result=auto.candidate;return;}
  await write('cs:button_workout',{owner,candidate},db);
 });
 await syncWorkoutLiveActivity().catch(()=>{});return result;
}
export async function controlButtonWorkout(kind:'SELECT'|'RESTART'|'STOP',id:string,key?:string){
 const owner=await authenticatedOwner();let handled=false;
 await transaction(async db=>{
  const w=await read<ButtonWorkout|null>('cs:button_workout',null,db);if(!w||w.owner!==owner||w.candidate.visit_id!==id)return;
  if(await read('auth_blocked',false,db))throw new Error('AUTH_REQUIRED');
  handled=true;const now=Date.now();if(now<Date.parse(w.candidate.entered_at))throw new Error('Your phone clock changed. Please try again.');
  if(kind==='STOP'){
   if(now-Date.parse(w.candidate.entered_at)<60000)throw new Error('Keep going for at least one minute before saving.');
   const pending=await read<ButtonWorkout[]>('cs:button_pending',[],db);pending.push({...w,ended_at:new Date(Math.min(now,Date.parse(w.candidate.entered_at)+14400000)).toISOString()});
   await write('cs:button_pending',pending,db);await write('cs:button_workout',null,db);
  }else{const chosen=activity(key??w.candidate.activity_key);if(kind==='SELECT'&&chosen.key!==key)throw new Error('Choose a workout type.');await write('cs:button_workout',{...w,candidate:{...w.candidate,...(kind==='RESTART'?{entered_at:new Date(now).toISOString()}:{activity_key:chosen.key,workout_label:chosen.label})}},db);}
 });
 if(handled){await syncWorkoutLiveActivity().catch(()=>{});if(kind==='STOP')await syncButtonWorkouts().catch(()=>{});}return handled;
}
let syncing:Promise<void>|undefined;
export function syncButtonWorkouts(){syncing??=sync().finally(()=>{syncing=undefined;});return syncing;}
async function sync(){
 const owner=await authenticatedOwner();const pending=await read<ButtonWorkout[]>('cs:button_pending',[]);
 for(const w of pending.filter(x=>x.owner===owner)){
  if(await authenticatedOwner()!==owner)throw new Error('AUTH_REQUIRED');
  await call('cs_timed_session',{payload:{auth_owner:owner,id:w.candidate.visit_id,activity_key:w.candidate.activity_key,started_at:w.candidate.entered_at,ended_at:w.ended_at,place_id:w.candidate.place_id||null}});
  await transaction(async db=>{if(await read('auth_blocked',false,db))return;const current=await read<ButtonWorkout[]>('cs:button_pending',[],db);await write('cs:button_pending',current.filter(x=>x.owner!==owner||x.candidate.visit_id!==w.candidate.visit_id),db);});
 }
}
