import type { ActivityKey, Goal, Session, Source, Week } from "./model";
export type Fix = { timestamp: number; latitude: number; longitude: number; accuracy: number | null; speed: number | null };
export type Candidate = { visit_id?: string; place_id: string; activity_key: ActivityKey; workout_label: string; entered_at: string; source: Source; lat: number; lng: number; radius_m: number };
export type Evaluation = { qualifies: boolean; reason: string; duration_sec: number; estimated: boolean };
const minutes: Record<string, number> = { reformer: 35, mat: 35, hot: 35, yoga: 35, cycling: 30, barre: 35, hiit: 30, boxing: 30, gym: 25 };
export function distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
 const r=Math.PI/180;const s=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371000*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
export function retainedVisitFixes(fixes:Fix[],place:{lat:number;lng:number;radius_m:number},now:number){
 return fixes.filter(f=>f.timestamp>=now-2*60*60*1000&&f.timestamp<=now&&f.accuracy!==null&&f.accuracy>=0&&f.accuracy<=100&&distanceMeters({lat:f.latitude,lng:f.longitude},place)<=place.radius_m).slice(-300);
}
export function evaluateVisit(candidate: Candidate, exitedAt: string, _fixes: Fix[] = [], estimated = false): Evaluation {
 const start=Date.parse(candidate.entered_at),end=Date.parse(exitedAt),duration=Math.floor((end-start)/1000);
 if(!Number.isFinite(duration)||duration<0) return {qualifies:false,reason:"Clock moved backwards",duration_sec:0,estimated};
 if(duration<180) return {qualifies:false,reason:"Drive-by: under 3 minutes",duration_sec:duration,estimated};
 if(duration<(minutes[candidate.activity_key]??25)*60) return {qualifies:false,reason:`Under ${(minutes[candidate.activity_key]??25)} minutes`,duration_sec:duration,estimated};
 // Movement-triggered samples overrepresent arrival/departure and cannot establish
 // the speed of a whole workout. Duration remains the drive-by safeguard.
 return {qualifies:true,reason:estimated?"Counted · estimated departure":"Counted",duration_sec:Math.min(14400,duration),estimated};
}
export function dayKey(instant: string | Date, tz: string) {
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(instant));
 return ["year","month","day"].map(k=>p.find(x=>x.type===k)?.value).join("-");
}
export function mondayKey(instant: string | Date, tz: string) {const d=new Date(dayKey(instant,tz)+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function shiftDay(day: string, amount: number) {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
export function countedSessions(sessions: Session[]): Session[] {
 const seen=new Set<string>();return sessions.filter(s=>!s.removed_at).sort((a,b)=>a.started_at.localeCompare(b.started_at)||a.id.localeCompare(b.id)).map(s=>{const key=`${s.activity_key}:${s.day_key}`;const counted=!seen.has(key);seen.add(key);return {...s,counted};});
}
export function progress(sessions: Session[], weeks: Week[], goals: Goal[], tz: string, now = new Date()) {
 const current=mondayKey(now,tz);const valid=sessions.filter(s=>s.counted&&!s.removed_at&&Date.parse(s.started_at)<=now.getTime());
 const getGoal=(week:string)=>[...weeks].filter(w=>w.week_key<=week).sort((a,b)=>b.week_key.localeCompare(a.week_key))[0]?.goal??goals.reduce((n,g)=>n+g.goal,0);
 const count=(week:string)=>valid.filter(s=>s.week_key===week).length;
 const hit=(week:string)=>getGoal(week)>0&&count(week)>=getGoal(week);
 let streak=hit(current)?1:0;let w=shiftDay(current,-7);
 for(let n=0;n<520&&hit(w);n++,w=shiftDay(w,-7))streak++;
 const history=Array.from({length:12},(_,i)=>{const week=shiftDay(current,(i-11)*7);return {week,count:count(week),goal:getGoal(week),hit:hit(week)};});
 return {count:count(current),goal:getGoal(current),streak,lifetime:valid.length,history,week:current};
}
