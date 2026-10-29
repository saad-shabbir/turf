import {read,write} from '../db/local';
import {call} from './api';
import {dayKey,mondayKey} from './engine';
import type {Snapshot} from './model';
import {planItemsForSync} from './planning';
import {loadWeeklyPlanning} from './planningStore';

// Upload the weekly plan when it changed or a new day began. Friends' profiles
// and the "hasn't started" alert read this copy; the phone's plan stays the source.
let running:Promise<void>|undefined;
export function syncPlan(snapshot:Snapshot,force=false){
 running=(running??Promise.resolve()).catch(()=>{}).then(async()=>{
  const planning=await loadWeeklyPlanning(snapshot);const now=new Date();
  const items=planItemsForSync(planning,mondayKey(now,snapshot.profile.tz));
  const fingerprint=JSON.stringify([dayKey(now,snapshot.profile.tz),items]);const key='cs:plan_synced:'+snapshot.profile.id;
  if(!force&&await read<string|null>(key,null)===fingerprint)return;
  await call('cs_plan_sync',{items});await write(key,fingerprint);
 });
 return running;
}
