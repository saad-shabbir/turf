// Workouts in progress, as seen by friends and by the server's 3-hour check.
// The phone reports a start once, pings while the app is open, and reports the
// end. A failed report is retried on the next app tick, so the server copy
// converges with what this phone shows.
import * as Notifications from 'expo-notifications';
import {localOwner} from '../auth/client';
import {read,write} from '../db/local';
import {call} from './api';
import {activity} from './model';
import type {Candidate} from './engine';
import {TWO_HOURS,THREE_HOURS} from './workoutRules';
export {creditedEnd,TWO_HOURS,THREE_HOURS} from './workoutRules';

export type StartedBy='button'|'photo'|'arrival';
type Reported={owner:string;id:string;activity_key:string;started_by:StartedBy;pinged_at:number};
const KEY='cs:live_reported';
const PHOTO_KEY='cs:photo_started';
const ACTIVITY_KEY='cs:workout_activity';


// Mark a timer as started from a photo before the next tick reports it.
export async function markPhotoStart(id:string){await write(PHOTO_KEY,id);}
export function startedBy(candidate:Candidate,photoId:string|null):StartedBy{
 return candidate.source==='manual'?(photoId===candidate.visit_id?'photo':'button'):'arrival';
}

export async function lastActivity(id:string){const value=await read<{id:string;at:number}|null>(ACTIVITY_KEY,null);return value?.id===id?value.at:null;}

// Called every few seconds while the app is open with the current workout.
export async function syncLiveWorkout(candidate:Candidate|null,notifyPreference:boolean){
 const owner=await localOwner().catch(()=>null);if(!owner)return;
 const reported=await read<Reported|null>(KEY,null);const now=Date.now();
 if(reported&&reported.owner===owner&&(!candidate||candidate.visit_id!==reported.id)){
  await cancelWorkoutChecks(reported.id);
  await call('cs_workout',{action:'stop',payload:{id:reported.id}});
  await write(KEY,null);
 }
 if(!candidate?.visit_id)return;
 const seen=await read<{id:string;at:number}|null>(ACTIVITY_KEY,null);
 if(seen?.id!==candidate.visit_id||now-seen.at>=60000)await write(ACTIVITY_KEY,{id:candidate.visit_id,at:now});
 const current=await read<Reported|null>(KEY,null);
 const by=startedBy(candidate,await read<string|null>(PHOTO_KEY,null));
 if(current?.owner===owner&&current.id===candidate.visit_id&&current.activity_key===candidate.activity_key&&current.started_by===by){
  if(now-current.pinged_at>=5*60000){await call('cs_workout',{action:'ping',payload:{id:candidate.visit_id,at:new Date(now).toISOString()}});await write(KEY,{...current,pinged_at:now});}
  return;
 }
 await call('cs_workout',{action:'start',payload:{id:candidate.visit_id,activity_key:candidate.activity_key,started_at:candidate.entered_at,started_by:by,place_id:candidate.place_id||null}});
 await write(KEY,{owner,id:candidate.visit_id,activity_key:candidate.activity_key,started_by:by,pinged_at:now});
 if(by!=='arrival'&&notifyPreference)await scheduleWorkoutChecks(candidate).catch(()=>{});
}

// Arrival alerts run in the background location task, where the app tick does not.
export async function announceArrival(){
 const state=await read<{owner:string;paused:boolean;candidate:Candidate|null}|null>('cs:tracking',null);
 if(state&&!state.paused&&state.candidate)await syncLiveWorkout(state.candidate,false);
}

export async function registerWorkoutCategory(){
 await Notifications.setNotificationCategoryAsync('workout-check',[
  {identifier:'stop',buttonTitle:'Stop workout',options:{opensAppToForeground:true}},
  {identifier:'continue',buttonTitle:'I’m still going',options:{opensAppToForeground:true}},
 ]);
}
// Local, so these work in the current build without remote push.
async function scheduleWorkoutChecks(c:Candidate){
 if(!(await Notifications.getPermissionsAsync()).granted)return;
 const start=Date.parse(c.entered_at);const label=activity(c.activity_key).label;
 const at2=new Date(start+TWO_HOURS),at3=new Date(start+THREE_HOURS);
 if(at2.getTime()>Date.now())await Notifications.scheduleNotificationAsync({identifier:'workout-check:'+c.visit_id,content:{title:'Still working out?',body:`Your ${label} timer has been running for 2 hours. Tap Stop if you’re done.`,categoryIdentifier:'workout-check',data:{pane:'active-workout',visit_id:c.visit_id}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:at2}});
 if(at3.getTime()>Date.now())await Notifications.scheduleNotificationAsync({identifier:'workout-closed:'+c.visit_id,content:{title:'We stopped your workout timer.',body:'It ran for 3 hours, so we saved it up to your last activity. You can edit it in History.',data:{pane:'history'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:at3}});
}
export async function cancelWorkoutChecks(id:string){
 await Notifications.cancelScheduledNotificationAsync('workout-check:'+id).catch(()=>{});
 await Notifications.cancelScheduledNotificationAsync('workout-closed:'+id).catch(()=>{});
}
