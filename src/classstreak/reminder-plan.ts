import {activity,type Snapshot} from "./model.ts";
import {dayKey,mondayKey,shiftDay} from "./engine.ts";
export type Reminder={id:string;at:Date;title:string;body:string;pane:string};
export function localTime(day:string,hour:number,minute:number,zone:string){
 const expected=Date.parse(`${day}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00Z`);let value=expected;
 for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(value);const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));const seen=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);value+=expected-seen;}
 return new Date(value);
}
export function quietUntil(now:Date,zone:string){
 const day=dayKey(now,zone);const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:zone,hour:"numeric",hourCycle:"h23"}).format(now));
 return hour>=22?localTime(shiftDay(day,1),7,0,zone):hour<7?localTime(day,7,0,zone):null;
}
export function reminderPlan(s:Snapshot,now:Date):Reminder[]{
 const result:Reminder[]=[];const zone=s.profile.tz;const prefs=s.profile.notification_preferences;const today=dayKey(now,zone);const week=mondayKey(now,zone);
 const currentGoal=s.weeks.filter(w=>w.week_key<=week).sort((a,b)=>b.week_key.localeCompare(a.week_key))[0]?.goal??s.goals.reduce((n,g)=>n+g.goal,0);
 const count=s.sessions.filter(x=>!x.removed_at&&x.counted&&x.week_key===week).length;
 for(let offset=0;offset<28;offset++){
  const day=shiftDay(today,offset);const weekday=(new Date(day+"T12:00:00Z").getUTCDay()+6)%7;const usual=s.usual_days.filter(d=>d.weekday===weekday).sort((a,b)=>({morning:0,midday:1,evening:2}[a.time_of_day]-{morning:0,midday:1,evening:2}[b.time_of_day])).find(d=>!s.sessions.some(x=>!x.removed_at&&x.counted&&x.day_key===day&&(!d.activity_key||x.activity_key===d.activity_key)));
  const logged=s.sessions.some(x=>!x.removed_at&&x.counted&&x.day_key===day&&(!usual?.activity_key||x.activity_key===usual.activity_key));
  if(usual&&prefs.usual!==false&&!logged){const hour=usual.time_of_day==="morning"?8:usual.time_of_day==="midday"?12:17;const label=new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z"));result.push({id:"usual:"+day,at:localTime(day,hour,0,zone),title:`It’s ${label}. ${activity(usual.activity_key??s.goals.find(g=>g.goal>0)?.activity_key??"reformer").short}${usual.time_of_day==="evening"?" at 6?":" today?"}`,body:offset===0&&s.friends.some(f=>f.status==="accepted"&&f.days.includes(weekday))?`${s.friends.find(f=>f.status==="accepted"&&f.days.includes(weekday))!.first_name} already went today. Your next session counts.`:"Your usual day is here. Go to class. It counts itself.",pane:"home"});}
  if(weekday===5&&prefs.risk!==false&&(day>=shiftDay(week,7)||count<currentGoal))result.push({id:"risk:"+day,at:localTime(day,10,0,zone),title:"Two days left in your week.",body:"Open ClassStreak to see your progress.",pane:"home"});
  if(weekday===6&&prefs.recap!==false)result.push({id:"recap:"+day,at:localTime(day,18,0,zone),title:"Your week, counted.",body:"Your weekly recap is ready in ClassStreak.",pane:"recap"});
 }
 return result.filter(r=>r.at>now);
}
