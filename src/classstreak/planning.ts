import {activity, type ActivityKey, type Schedule, type Snapshot, type TimeOfDay} from './model.ts';
import {dayKey, mondayKey, shiftDay} from './engine.ts';
import {localTime, type Reminder} from './reminder-plan.ts';

export type PlanRule = {id:string; weekday:number; activity_key:ActivityKey; time:string|null; period:TimeOfDay; focus:string; reminder:boolean};
export type PlanOverride = {day:string; rule_id:string; activity_key:ActivityKey; time:string|null; period:TimeOfDay; focus:string; reminder:boolean; skipped?:boolean};
export type RestDayChoice = 'yes'|'no'|'maybe';
export type WeeklyPlanning = {version:1; rules:PlanRule[]; overrides:PlanOverride[]; rest_days?:Record<string,RestDayChoice>};
export type PlannedWorkout = Omit<PlanRule,'weekday'> & {day:string; recurring:boolean; changed:boolean};
export const emptyPlanning = ():WeeklyPlanning=>({version:1,rules:[],overrides:[]});
export const validTime = (value:unknown):value is string=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const periodTime = (period:TimeOfDay)=>period==='morning'?'09:00':period==='midday'?'13:00':'18:00';
export function formatPlanTime(time:string){
 const [hour,minute]=time.split(':').map(Number);return `${hour!%12||12}:${String(minute).padStart(2,'0')} ${hour!<12?'AM':'PM'}`;
}
export function weekdayOf(day:string){return (new Date(day+'T12:00:00Z').getUTCDay()+6)%7;}
export function weekCalendar(day:string){const monday=mondayKey(new Date(day+'T12:00:00Z'),'UTC');return Array.from({length:7},(_,i)=>shiftDay(monday,i));}
export function schedulesToRules(schedules:Schedule[]):PlanRule[]{
 return schedules.flatMap(schedule=>[...new Set(schedule.days)].filter(d=>Number.isInteger(d)&&d>=0&&d<=6).map(weekday=>({id:`${schedule.activity_key}:${weekday}`,weekday,activity_key:schedule.activity_key,time:validTime(schedule.exact_time)?schedule.exact_time:null,period:schedule.time,focus:'',reminder:schedule.reminder_enabled!==false})));
}
export function planningFromSnapshot(snapshot:Snapshot):WeeklyPlanning{
 const keys=[...new Set(snapshot.usual_days.map(d=>d.activity_key??snapshot.goals[0]?.activity_key??'gym'))];
 return {version:1,overrides:[],rules:keys.flatMap(key=>snapshot.usual_days.filter(d=>!d.activity_key||d.activity_key===key).map(d=>({id:`${key}:${d.weekday}`,weekday:d.weekday,activity_key:key,time:null,period:d.time_of_day,focus:'',reminder:true})))};
}
export function workoutsOn(planning:WeeklyPlanning,day:string):PlannedWorkout[]{
 const recurring=planning.rules.filter(r=>r.weekday===weekdayOf(day));
 const changed=planning.overrides.filter(o=>o.day===day);
 const entries:PlannedWorkout[]=recurring.flatMap(rule=>{
  const override=changed.find(o=>o.rule_id===rule.id);if(override?.skipped)return [];
  return [{...rule,...override,id:rule.id,day,recurring:true,changed:!!override}];
 });
 for(const override of changed)if(!override.skipped&&!recurring.some(r=>r.id===override.rule_id))entries.push({...override,id:override.rule_id,recurring:false,changed:true});
 return entries.sort((a,b)=>(a.time??periodTime(a.period)).localeCompare(b.time??periodTime(b.period))||a.id.localeCompare(b.id));
}
export function setRestDayChoice(planning:WeeklyPlanning,day:string,choice:RestDayChoice|null):WeeklyPlanning{
 const rest_days={...planning.rest_days};if(choice)rest_days[day]=choice;else delete rest_days[day];
 return {...planning,rest_days};
}
export function restDayPrompt(planning:WeeklyPlanning,day:string,today:string,hasLoggedWorkout:boolean):'question'|'rest'|'reminder'|null{
 if(day<today||hasLoggedWorkout||workoutsOn(planning,day).length)return null;
 const choice=planning.rest_days?.[day];return choice==='yes'?'rest':choice==='no'||choice==='maybe'?'reminder':'question';
}
export function savePlannedWorkout(planning:WeeklyPlanning,workout:PlannedWorkout,repeat:boolean):WeeklyPlanning{
 planning=setRestDayChoice(planning,workout.day,null);
 const cleaned={...workout,time:validTime(workout.time)?workout.time:null,focus:workout.focus.trim().slice(0,60)};
 if(repeat){
  const rule:PlanRule={id:workout.id,weekday:weekdayOf(workout.day),activity_key:cleaned.activity_key,time:cleaned.time,period:cleaned.period,focus:cleaned.focus,reminder:cleaned.reminder};
  return {...planning,rules:[...planning.rules.filter(r=>r.id!==rule.id),rule],overrides:planning.overrides.filter(o=>!(o.day===workout.day&&o.rule_id===rule.id))};
 }
 const override:PlanOverride={day:workout.day,rule_id:workout.id,activity_key:cleaned.activity_key,time:cleaned.time,period:cleaned.period,focus:cleaned.focus,reminder:cleaned.reminder};
 return {...planning,overrides:[...planning.overrides.filter(o=>!(o.day===workout.day&&o.rule_id===workout.id)),override]};
}
export function removePlannedWorkout(planning:WeeklyPlanning,workout:PlannedWorkout,repeat:boolean):WeeklyPlanning{
 if(repeat)return {...planning,rules:planning.rules.filter(r=>r.id!==workout.id),overrides:planning.overrides.filter(o=>o.rule_id!==workout.id)};
 const rest=planning.overrides.filter(o=>!(o.day===workout.day&&o.rule_id===workout.id));
 if(!planning.rules.some(r=>r.id===workout.id))return {...planning,overrides:rest};
 return {...planning,overrides:[...rest,{day:workout.day,rule_id:workout.id,activity_key:workout.activity_key,time:workout.time,period:workout.period,focus:workout.focus,reminder:false,skipped:true}]};
}
export function restorePlannedWorkout(planning:WeeklyPlanning,day:string,id:string):WeeklyPlanning{return {...planning,overrides:planning.overrides.filter(o=>!(o.day===day&&o.rule_id===id))};}

// Move only this occurrence. Keep the recurring rule and every other date intact.
export function reschedulePlannedWorkout(planning:WeeklyPlanning,original:PlannedWorkout,replacement:PlannedWorkout):WeeklyPlanning{
 if(original.day===replacement.day)return savePlannedWorkout(planning,replacement,false);
 const removed=removePlannedWorkout(planning,original,false);
 return savePlannedWorkout(removed,{...replacement,id:`moved:${original.id}:${original.day}:${replacement.day}`,recurring:false,changed:true},false);
}

// Exact local times are resolved in the profile time zone for each occurrence,
// rather than adding seven 24-hour periods across daylight saving changes.
export function plannedReminders(planning:WeeklyPlanning,snapshot:Snapshot,now:Date):Reminder[]{
 if(snapshot.profile.notification_preferences.usual===false)return [];
 const today=dayKey(now,snapshot.profile.tz);const reminders:Reminder[]=[];
 for(let i=0;i<28;i++)for(const workout of workoutsOn(planning,shiftDay(today,i))){
  if(!workout.reminder||snapshot.sessions.some(s=>!s.removed_at&&s.day_key===workout.day&&s.activity_key===workout.activity_key&&s.source!=='seed'&&s.source!=='simulated'))continue;
  const time=workout.time??periodTime(workout.period);const [hour,minute]=time.split(':').map(Number);
  const starts=localTime(workout.day,hour!,minute!,snapshot.profile.tz);
  // 02:30 does not exist on spring-forward day. Skip that occurrence rather than
  // silently notifying at a different wall-clock time.
  const rendered=new Intl.DateTimeFormat('en-GB',{timeZone:snapshot.profile.tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(starts);
  if(rendered!==time)continue;
  const at=new Date(starts.getTime()-60*60*1000);if(at<=now)continue;
  const label=activity(workout.activity_key).label;
  reminders.push({id:`plan:${snapshot.profile.id}:${workout.day}:${workout.id}`,at,title:`An hour until ${label.toLowerCase()}.`,body:`${workout.focus?workout.focus+' · ':''}${formatPlanTime(time)}. A little time for you. You’ve got this.`,pane:'home'});
 }
 return reminders.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id.localeCompare(b.id));
}
