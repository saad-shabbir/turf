import {read,write,transaction} from '../db/local';
import type {Schedule,Snapshot} from './model';
import {emptyPlanning,planningFromSnapshot,schedulesToRules,type WeeklyPlanning} from './planning';

const key=(owner:string)=>'cs:weekly_planning:'+owner;
export async function loadWeeklyPlanning(snapshot:Snapshot):Promise<WeeklyPlanning>{
 return transaction(async db=>{
  const saved=await read<WeeklyPlanning|null>(key(snapshot.profile.id),null,db);
  if(saved?.version===1)return saved;
  const value=planningFromSnapshot(snapshot);await write(key(snapshot.profile.id),value,db);return value;
 });
}
export async function saveWeeklyPlanning(owner:string,value:WeeklyPlanning){await write(key(owner),value);}
export async function seedWeeklyPlanning(owner:string,schedules:Schedule[]){
 await transaction(async db=>{
  const existing=await read<WeeklyPlanning|null>(key(owner),null,db);
  if(existing)return;
  await write(key(owner),{...emptyPlanning(),rules:schedulesToRules(schedules)},db);
 });
}
export async function replaceWeeklySchedules(owner:string,schedules:Schedule[]){
 await transaction(async db=>{
  const previous=await read<WeeklyPlanning>(key(owner),emptyPlanning(),db);
  await write(key(owner),{...previous,rules:schedulesToRules(schedules)},db);
 });
}
export async function savedPlanningSchedules(snapshot:Snapshot):Promise<Schedule[]>{
 const plan=await loadWeeklyPlanning(snapshot);const keys=[...new Set([...snapshot.goals.map(g=>g.activity_key),...snapshot.pending_goals.map(g=>g.activity_key),...plan.rules.map(r=>r.activity_key)])];return keys.map(activity_key=>{
  const rules=plan.rules.filter(r=>r.activity_key===activity_key);const first=rules[0];
  return {activity_key,days:rules.map(r=>r.weekday),time:first?.period??'evening',exact_time:first?.time??undefined,reminder_enabled:first?.reminder??true};
 });
}
