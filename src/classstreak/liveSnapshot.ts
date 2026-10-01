import {activity,type Snapshot} from './model.ts';

// Legacy onboarding inserted sample records. Keep them on the server until the
// owner removes them, but never treat them as real progress at app launch.
export function liveSnapshot(value:Snapshot):Snapshot {
 const isReal=(source:string)=>source==='geofence'||source==='manual';
 const sessions=value.sessions.filter(s=>isReal(s.source));const counted=new Set<string>();const days=new Set<string>();
 const serverNow=Date.parse(value.server_time);const now=Number.isFinite(serverNow)?serverNow:Date.now();
 // A legacy sample can own the old server counted flag for this activity/day.
 // Rebuild only the visible projection; do not mutate or delete saved sessions.
 for(const session of [...sessions].sort((a,b)=>a.started_at.localeCompare(b.started_at)||a.id.localeCompare(b.id))){
  if(session.removed_at||Date.parse(session.started_at)>now||!(session.source==='manual'||session.duration_sec>=activity(session.activity_key).minutes*60))continue;
  const key=`${session.user_id}:${session.day_key}:${session.activity_key}`;
  if(!days.has(key)){days.add(key);counted.add(session.id);}
 }
 const real=sessions.map(s=>({...s,counted:counted.has(s.id)}));
 const demoPeople=new Set(value.friends.filter(f=>f.is_demo).map(f=>f.id));
 const history=real.filter(s=>s.counted).sort((a,b)=>a.started_at.localeCompare(b.started_at)||a.id.localeCompare(b.id));
 const ownAchievements=history.flatMap((s,i)=>[1,10,25,50,100,250].includes(i+1)&&Date.parse(s.started_at)>now-90*86400000?[{id:s.id,user_id:value.profile.id,first_name:value.profile.first_name,count:i+1,source:s.source}]:[]);
 return {...value,sessions:real,friends:value.friends.filter(f=>!f.is_demo),
  feed:value.feed.filter(f=>isReal(f.source)&&!demoPeople.has(f.user_id)),
  achievements:value.achievements===undefined?undefined:[...value.achievements.filter(a=>a.user_id!==value.profile.id&&isReal(a.source)&&!demoPeople.has(a.user_id)),...ownAchievements]};
}
