import {AppState} from 'react-native';
import {read,write} from '../db/local';
import type {Snapshot} from './model';
import {progress,type Candidate} from './engine';
import {liveSnapshot} from './liveSnapshot';
import {workoutActivityDriver,type WorkoutActivityProps} from './workoutLiveActivityNative';

type Binding={id:string;owner:string;visit:string;fingerprint:string};
type State={owner:string|null;paused:boolean;candidate:Candidate|null};
let syncing:Promise<void>=Promise.resolve();
let generation=0;
let suspended=false;
export function syncWorkoutLiveActivity({resume=false}:{resume?:boolean}={}){
 const ticket=generation;
 syncing=syncing.catch(()=>{}).then(()=>ticket===generation?reconcile(ticket,resume):undefined);
 return syncing;
}
export function clearWorkoutLiveActivity(){
 ++generation;
 suspended=true;
 syncing=syncing.catch(()=>{}).then(async()=>{
  if(workoutActivityDriver.supported)for(const item of workoutActivityDriver.list())await item.end('immediate');
  // Recovery may be clearing a lock-screen card while encrypted storage cannot
  // be opened. Do not make native cleanup depend on reading that storage.
  await write('cs:live_activity',null).catch(()=>{});
  await write('cs:live_activity_status','none').catch(()=>{});
 });
 return syncing;
}
async function reconcile(ticket:number,resume:boolean){
 if(!workoutActivityDriver.supported)return;
 if(suspended&&!resume)return;
 const epoch=await read('auth_epoch',0);
 let state=await read<State>('cs:tracking',{owner:null,paused:true,candidate:null});
 const button=await read<{owner:string;candidate:Candidate}|null>('cs:button_workout',null);
 if(button)state={owner:button.owner,paused:false,candidate:button.candidate};
 const cache=await read<{auth:string;value:Snapshot}|null>('cs:snapshot',null);
 const binding=await read<Binding|null>('cs:live_activity',null);
 const blocked=await read('auth_blocked',false);
 // Only the authenticated foreground refresh can explicitly resume after a
 // clear. A later background callback must not resurrect a signed-out card.
 if(resume&&ticket===generation&&!blocked&&state.owner&&cache?.auth===state.owner&&await read('auth_epoch',0)===epoch)suspended=false;
 if(suspended)return;
 const c=state.candidate;
 const allowed=!blocked&&!state.paused&&state.owner&&cache?.auth===state.owner&&c?.visit_id&&(c.source==='geofence'||c.source==='manual')&&Number.isFinite(Date.parse(c.entered_at))&&Date.parse(c.entered_at)<=Date.now()&&Date.now()-Date.parse(c.entered_at)<14400000;
 let instances;
 try{instances=workoutActivityDriver.list();}catch{await write('cs:live_activity_status','unavailable');return;}
 if(!allowed){for(const item of instances)await item.end('immediate');await write('cs:live_activity',null);await write('cs:live_activity_status','none');return;}
 const s=liveSnapshot(cache!.value),stats=progress(s.sessions.filter(session=>session.user_id===s.profile.id),s.weeks,s.goals,s.profile.tz,new Date());
 const props:WorkoutActivityProps={label:c!.workout_label.slice(0,60),startedAt:Date.parse(c!.entered_at),count:stats.count,goal:stats.goal,accent:s.profile.theme==='sage'?'#AAC996':s.profile.theme==='blush'?'#E8A2B5':'#E9AA7D'};
 const fingerprint=JSON.stringify(props),staleDate=new Date(props.startedAt+14400000);
 const boundVisit=binding?.owner===state.owner&&binding.visit===c!.visit_id;
 const existing=boundVisit?instances.find(item=>item.getId()===binding!.id):undefined;
 for(const item of instances)if(item!==existing)await item.end('immediate');
 if(ticket!==generation||await read('auth_epoch',0)!==epoch||await read('auth_blocked',false)){for(const item of instances)await item.end('immediate');return;}
 // A missing instance for an already-bound visit can mean the user dismissed
 // it on the Lock Screen. Respect that choice for the rest of this workout.
 if(boundVisit&&!existing){await write('cs:live_activity_status','dismissed');return;}
 try{
  let current=existing;
  if(!current){
   // ActivityKit cannot start a new activity from a background geofence callback.
   // The arrival notification opens the picker; the elapsed timer uses the saved arrival.
   if(AppState.currentState!=='active'){await write('cs:live_activity_status','pending');return;}
   current=workoutActivityDriver.start(props,staleDate);
  }else if(binding?.fingerprint!==fingerprint)await current.update(props,staleDate);
  let latest=await read<State>('cs:tracking',{owner:null,paused:true,candidate:null});
  const buttonNow=await read<{owner:string;candidate:Candidate}|null>('cs:button_workout',null);if(buttonNow)latest={owner:buttonNow.owner,paused:false,candidate:buttonNow.candidate};
  if(ticket!==generation||await read('auth_epoch',0)!==epoch||await read('auth_blocked',false)||latest.owner!==state.owner||latest.paused||latest.candidate?.visit_id!==c!.visit_id){await current.end('immediate');return;}
  await write('cs:live_activity',{id:current.getId(),owner:state.owner,visit:c!.visit_id,fingerprint});
  await write('cs:live_activity_status','active');
 }catch{await write('cs:live_activity_status','unavailable');}
}
