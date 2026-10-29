// Regression tests for the privacy review of the social update (PR #5).
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';

const setup=async(db,auth,name,last='Private',tz='UTC')=>{await actor(db,auth);const s=await rpc(db,'cs_bootstrap',[{first_name:name,last_name:last,selected:['gym'],goals:{gym:2},tz,days:[]}]);return {...s,auth};};
const befriend=async(db,a,b)=>{await actor(db,b.auth);await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);await db.exec('reset role');await db.query("update classstreak.friendships set accepted_at=now()-interval '2 days' where status='accepted'");};
const token=n=>`ExponentPushToken[${String(n).padEnd(22,'x')}]`;
const count=async(db,sql,args=[])=>{await db.exec('reset role');return (await db.query(sql,args)).rows[0].n;};
const ago=minutes=>new Date(Date.now()-minutes*60000).toISOString();
const hour=tz=>Number(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'}).format(new Date()));
// A zone where it is daytime now, so pushes are not held for quiet hours.
const daytime=()=>['UTC','Europe/London','America/New_York','America/Los_Angeles','Pacific/Honolulu','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'].find(z=>hour(z)>=9&&hour(z)<=20);

test('a friend cannot take over, end or attach to someone else’s workout in progress',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  const wid=randomUUID();
  await actor(db,A);await rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:ago(20),started_by:'button'}]);
  await actor(db,B);const live=(await rpc(db,'cs_snapshot')).live.find(x=>x.user_id===a.profile.id);
  assert.ok(live);assert.equal(live.id,undefined);assert.equal(live.started_at,undefined);
  // Even with the id (for example from a photo path), Bob gets nowhere.
  await assert.rejects(rpc(db,'cs_timed_session',[{auth_owner:B,id:wid,activity_key:'gym',started_at:ago(10),ended_at:ago(1)}]),/FORBIDDEN/);
  await assert.rejects(rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:ago(1),started_by:'button'}]),/FORBIDDEN/);
  await rpc(db,'cs_workout',['stop',{id:wid}]);
  assert.equal(await count(db,'select count(*)::int n from classstreak.active_workouts where id=$1 and user_id=$2',[wid,a.profile.id]),1);
  await actor(db,A);await rpc(db,'cs_timed_session',[{auth_owner:A,id:wid,activity_key:'gym',started_at:ago(20),ended_at:new Date().toISOString()}]);
  assert.equal(await count(db,'select count(*)::int n from classstreak.sessions where id=$1 and user_id=$2',[wid,a.profile.id]),1);
  assert.equal(await count(db,'select count(*)::int n from classstreak.active_workouts'),0);
 }finally{await db.close();}
});

test('the session trigger only ends the owner’s own live workout',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  const wid=randomUUID();await actor(db,A);await rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:ago(5),started_by:'button'}]);
  await db.exec('reset role');
  // Simulate another person's session row carrying the same id.
  await db.query(`insert into classstreak.sessions(id,user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,verified,week_key,day_key,event_key)
   values($1,$2,'gym','Gym',now()-interval '1 hour',now(),3600,'manual',false,classstreak.monday(now(),'UTC'),current_date,'test:x')`,[wid,b.profile.id]);
  assert.equal(await count(db,'select count(*)::int n from classstreak.active_workouts where id=$1',[wid]),1);
 }finally{await db.close();}
});

test('search never reveals last names letter by letter',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice','Zimmerman');await rpc(db,'cs_settings',['profile',{discoverable:true}]);await setup(db,C,'Cara');
  await actor(db,C);
  for(const q of ['alice z','alice zim','alice zimq','zimmer','zim'])assert.deepEqual(await rpc(db,'cs_people_search',[q]),[],q);
  for(const q of ['alice zimmerman','Zimmerman','ali'])assert.deepEqual((await rpc(db,'cs_people_search',[q])).map(p=>p.id),[a.profile.id],q);
 }finally{await db.close();}
});

test('a pending request shows the requester’s photo to the receiver only',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');await rpc(db,'cs_settings',['profile',{discoverable:true}]);const c=await setup(db,C,'Cara');
  const avatar=async(who,auth)=>{await actor(db,auth);const path=`${auth}/avatar/${randomUUID()}.jpg`;await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',path]);await rpc(db,'cs_set_avatar',[path]);return path;};
  const alicePhoto=await avatar(a,A),caraPhoto=await avatar(c,C);
  const canRead=async(auth,path)=>{await actor(db,auth);return (await db.query('select 1 from storage.objects where name=$1',[path])).rows.length;};
  await actor(db,C);const found=await rpc(db,'cs_people_search',['al']);
  const snap=await rpc(db,'cs_social',['request',{id:found[0].id}]);
  assert.equal(snap.friends.find(x=>x.id===a.profile.id).avatar_path,null);
  assert.equal(await canRead(C,alicePhoto),0);
  await actor(db,A);assert.equal((await rpc(db,'cs_snapshot')).friends.find(x=>x.id===c.profile.id).avatar_path,caraPhoto);
  assert.equal(await canRead(A,caraPhoto),1);
 }finally{await db.close();}
});

test('missed-plan alerts are capped at one per friend per day, and passed times cannot be added',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  await actor(db,B);await rpc(db,'cs_push_token',[token(1),true]);
  const at=new Date(Date.now()-75*60000);const day=at.toISOString().slice(0,10);const t=at.toISOString().slice(11,16);
  if(day!==new Date().toISOString().slice(0,10))return; // just after UTC midnight; covered by the other tests
  await actor(db,A);
  const first=await rpc(db,'cs_plan_sync',[Array.from({length:40},(_,i)=>({day,slot:`r0-${i}`,activity_key:'gym',time:t,period:'morning'}))]);
  assert.equal(first.saved,3);
  await db.exec('reset role');await db.query('select classstreak.social_checks()');
  for(let round=1;round<3;round++){
   await actor(db,A);const again=await rpc(db,'cs_plan_sync',[Array.from({length:40},(_,i)=>({day,slot:`r${round}-${i}`,activity_key:'gym',time:t,period:'morning'}))]);
   assert.equal(again.saved,0);
   await db.exec('reset role');await db.query('select classstreak.social_checks()');
  }
  assert.equal(await count(db,"select count(*)::int n from classstreak.push_outbox where user_id=$1 and kind='plan_missed'",[b.profile.id]),1);
  assert.equal(await count(db,"select count(*)::int n from classstreak.inbox where user_id=$1 and kind='plan_missed'",[b.profile.id]),1);
  assert.equal(await count(db,'select count(*)::int n from classstreak.plans where user_id=$1 and day=$2',[a.profile.id,day]),3);
 }finally{await db.close();}
});

test('a backdated start is credited from its start, not from when it was reported',async()=>{
 const db=await fresh();try{
  await setup(db,A,'Alice');const wid=randomUUID();
  await rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:ago(3*60+59),started_by:'photo'}]);
  await db.exec('reset role');await db.query('select classstreak.social_checks()');
  const row=(await db.query('select duration_sec,source,verified from classstreak.sessions where id=$1',[wid])).rows[0];
  assert.deepEqual(row,{duration_sec:7200,source:'manual',verified:false});
 }finally{await db.close();}
});

test('one broken workout or plan does not stop the other scheduled checks',async()=>{
 const db=await fresh();try{
  await setup(db,A,'Alice');const bad=randomUUID();await rpc(db,'cs_workout',['start',{id:bad,activity_key:'gym',started_at:ago(20),started_by:'button'}]);
  await setup(db,B,'Bob');const good=randomUUID();await rpc(db,'cs_workout',['start',{id:good,activity_key:'gym',started_at:ago(20),started_by:'button'}]);
  await db.exec('reset role');
  await db.query("update classstreak.active_workouts set started_at=now()-interval '190 minutes',last_activity_at=now()-interval '190 minutes'");
  await db.query("update classstreak.users set tz='Not/AZone' where auth_id=$1",[A]);
  await db.query('select classstreak.social_checks()');
  assert.equal(await count(db,'select count(*)::int n from classstreak.sessions where id=$1',[good]),1);
  assert.equal(await count(db,'select count(*)::int n from classstreak.active_workouts where id=$1',[bad]),1);
 }finally{await db.close();}
});

test('failed pushes back off, auto-stops are not pushed, and a signed-out phone can release its token',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob','Private',daytime());await befriend(db,a,b);
  await actor(db,B);await rpc(db,'cs_push_token',[token(2),true]);
  await actor(db,A);await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'Hi',client_id:randomUUID()}]);
  await db.exec('reset role');
  let claimed=await rpc(db,'cs_push_claim',[10]);assert.equal(claimed.length,1);
  await rpc(db,'cs_push_done',[[{id:claimed[0].id,ok:false,error:'boom',invalid_tokens:[]}]]);
  assert.deepEqual(await rpc(db,'cs_push_claim',[10]),[]);
  const row=(await db.query('select send_after,attempts from classstreak.push_outbox')).rows[0];assert.ok(row.send_after>new Date(Date.now()+60000));assert.equal(row.attempts,1);
  // The 3-hour auto-stop stays in the inbox; the phone shows its own notification.
  await actor(db,B);const wid=randomUUID();await rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:ago(20),started_by:'button'}]);
  await db.exec('reset role');await db.query("update classstreak.active_workouts set started_at=now()-interval '190 minutes'");await db.query('select classstreak.social_checks()');
  assert.equal(await count(db,"select count(*)::int n from classstreak.inbox where kind='workout_stopped'"),1);
  assert.equal(await count(db,"select count(*)::int n from classstreak.push_outbox where kind in('workout_stopped','workout_check')"),0);
  await actor(db,null);await rpc(db,'cs_push_release',[token(2)]);
  assert.equal(await count(db,'select count(*)::int n from classstreak.push_tokens'),0);
 }finally{await db.close();}
});

test('people are not discoverable until they say yes, except by exact @handle',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');assert.equal(a.profile.discoverable,false);assert.equal(a.profile.discoverable_asked,false);
  await rpc(db,'cs_settings',['profile',{handle:'alice.lifts'}]);await setup(db,C,'Cara');
  await actor(db,C);assert.deepEqual(await rpc(db,'cs_people_search',['alice']),[]);
  assert.equal((await rpc(db,'cs_people_search',['@alice.lifts'])).length,1);
  await actor(db,A);const snap=await rpc(db,'cs_settings',['profile',{discoverable:true}]);assert.equal(snap.profile.discoverable_asked,true);
  await actor(db,C);assert.equal((await rpc(db,'cs_people_search',['alice'])).length,1);
 }finally{await db.close();}
});

test('blocking ends the friendship, hides both people from search and rejects new requests',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');await rpc(db,'cs_settings',['profile',{discoverable:true}]);
  const b=await setup(db,B,'Bob');await rpc(db,'cs_settings',['profile',{discoverable:true}]);
  await befriend(db,a,b);
  await actor(db,A);let snap=await rpc(db,'cs_social',['block',{id:b.profile.id}]);
  assert.equal(snap.friends.length,0);assert.deepEqual(snap.blocked,[{id:b.profile.id,first_name:'Bob'}]);
  await actor(db,B);assert.deepEqual(await rpc(db,'cs_people_search',['ali']),[]);
  await assert.rejects(rpc(db,'cs_social',['request',{id:a.profile.id}]),/INVITE_INVALID/);
  await assert.rejects(rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]),/INVITE_INVALID/);
  await assert.rejects(rpc(db,'cs_messages',['send',{peer:a.profile.id,body:'hey',client_id:randomUUID()}]),/FORBIDDEN/);
  await actor(db,A);assert.deepEqual(await rpc(db,'cs_people_search',['bob']),[]);
  snap=await rpc(db,'cs_social',['unblock',{id:b.profile.id}]);assert.deepEqual(snap.blocked,[]);
  await actor(db,B);assert.equal((await rpc(db,'cs_people_search',['ali'])).length,1);
 }finally{await db.close();}
});

test('every workout start is announced once, arrivals included, never late or when sharing is off',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  await actor(db,B);await rpc(db,'cs_push_token',[token(1),true]);
  const started=async(id,by='button',at=new Date().toISOString())=>{await actor(db,A);await rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:at,started_by:by}]);};
  const alerts=()=>count(db,"select count(*)::int n from classstreak.inbox where kind='friend_started'");
  // Each new workout is announced, with no time-based cap; re-sending the same id is not.
  const one=randomUUID();await started(one);await started(one);await started(one,'photo');
  assert.equal(await alerts(),1);
  await started(randomUUID(),'photo');await started(randomUUID(),'arrival');
  assert.equal(await alerts(),3);
  assert.equal(await count(db,"select count(*)::int n from classstreak.push_outbox where kind='friend_started'"),3);
  await actor(db,B);const live=(await rpc(db,'cs_snapshot')).live;assert.equal(live.length,1);assert.equal(live[0].started_at,undefined);assert.equal(live[0].started_minutes_ago,5);
  // A start synced 45 minutes late is shown live but not announced as "just started".
  await started(randomUUID(),'button',ago(45));assert.equal(await alerts(),3);
  // Turning sharing off hides every live workout and stops the alerts.
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_live:false}]);
  await started(randomUUID(),'arrival');await started(randomUUID(),'photo');
  await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).live.length,0);
  assert.equal(await alerts(),3);
 }finally{await db.close();}
});

test('friends hear when each workout finishes, however it ends, unless it was logged late or sharing is off',async()=>{
 const zone=daytime();assert.ok(zone);
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob','Private',zone),c=await setup(db,C,'Cara');
  await befriend(db,a,b);await befriend(db,a,c);
  await actor(db,B);await rpc(db,'cs_push_token',[token(3),true]);
  await actor(db,C);await rpc(db,'cs_social',['mute',{id:a.profile.id}]);
  const finished=async who=>count(db,"select count(*)::int n from classstreak.inbox i join classstreak.users u on u.id=i.user_id where u.auth_id=$1 and i.kind='friend_finished'",[who]);
  // Manual stop: 45 minutes of gym. Muted friends hear nothing.
  await actor(db,A);const one=randomUUID();await rpc(db,'cs_workout',['start',{id:one,activity_key:'gym',started_at:ago(45),started_by:'button'}]);
  await rpc(db,'cs_timed_session',[{auth_owner:A,id:one,activity_key:'gym',started_at:ago(45),ended_at:new Date().toISOString()}]);
  await rpc(db,'cs_timed_session',[{auth_owner:A,id:one,activity_key:'gym',started_at:ago(45),ended_at:new Date().toISOString()}]);
  assert.equal(await finished(B),1);assert.equal(await finished(C),0);
  await db.exec('reset role');const body=(await db.query("select i.body,i.session_id from classstreak.inbox i where i.kind='friend_finished'")).rows[0];
  assert.equal(body.body,'Alice just finished 45 min of gym. Nice work?');assert.equal(body.session_id,one);
  const push=(await db.query("select data from classstreak.push_outbox where kind='friend_finished'")).rows;assert.equal(push.length,1);assert.equal(push[0].data.pane,`friend:${a.profile.id}`);
  // Right after, the 3-hour auto-stop and a gym-arrival visit each count too, short ones included.
  await actor(db,A);await rpc(db,'cs_workout',['start',{id:randomUUID(),activity_key:'gym',started_at:ago(20),started_by:'button'}]);
  await db.exec('reset role');await db.query("update classstreak.active_workouts set started_at=now()-interval '185 minutes'");await db.query('select classstreak.social_checks()');
  assert.equal(await finished(B),2);
  const log=async(minutes,endedAgo,key,source='manual')=>{await db.exec('reset role');await db.query(`insert into classstreak.sessions(id,user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,verified,week_key,day_key,event_key)
   values(gen_random_uuid(),$1,'gym','Gym',now()-make_interval(mins=>$2::int+$3::int),now()-make_interval(mins=>$3::int),$2::int*60,$5,false,classstreak.monday(now(),'UTC'),current_date,$4)`,[a.profile.id,minutes,endedAgo,key,source]);};
  await log(6,1,'test:visit','geofence');assert.equal(await finished(B),3);
  // Logged more than 30 minutes late, or with sharing off: nothing.
  await log(40,45,'test:late');assert.equal(await finished(B),3);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_live:false}]);await log(40,0,'test:unshared');assert.equal(await finished(B),3);
  // The friend's "starts or finishes" switch turns it off.
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_live:true}]);
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{friend_started:false}}]);
  await log(40,0,'test:switched-off');assert.equal(await finished(B),3);
 }finally{await db.close();}
});

test('friends can cheer a workout in progress once each, and auto-cheer does it for them',async()=>{
 const zone=daytime();assert.ok(zone);
 const db=await fresh();try{
  const a=await setup(db,A,'Alice','Private',zone),b=await setup(db,B,'Bob'),c=await setup(db,C,'Cara');
  await befriend(db,a,b);await befriend(db,a,c);
  await actor(db,A);await rpc(db,'cs_push_token',[token(4),true]);
  await actor(db,B);await assert.rejects(rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),/NOT_WORKING_OUT/);
  // Cara turned on auto-cheer: Alice's start cheers her right away.
  await actor(db,C);await rpc(db,'cs_settings',['profile',{auto_cheer:true}]);
  await actor(db,A);const wid=randomUUID();await rpc(db,'cs_workout',['start',{id:wid,activity_key:'gym',started_at:new Date().toISOString(),started_by:'button'}]);
  await actor(db,B);let snap=await rpc(db,'cs_snapshot');assert.equal(snap.live[0].cheered,false);
  assert.deepEqual(await rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),{cheered:true});
  assert.deepEqual(await rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),{cheered:false});
  assert.equal((await rpc(db,'cs_snapshot')).live[0].cheered,true);
  await actor(db,A);snap=await rpc(db,'cs_snapshot');assert.equal(snap.active_workout.cheers,2);
  const cheers=snap.inbox.filter(i=>i.kind==='cheer').map(i=>i.body).sort();assert.deepEqual(cheers,['Bob cheered you on 🔥','Cara cheered you on 🔥']);
  await db.exec('reset role');assert.equal((await db.query("select data from classstreak.push_outbox where kind='cheer'")).rows[0].data.pane,'active-workout');
  // Only accepted friends, never yourself, and Alice's mute silences Bob's next cheer.
  await actor(db,A);await assert.rejects(rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),/FORBIDDEN/);
  await rpc(db,'cs_social',['mute',{id:b.profile.id}]);
  const second=randomUUID();await actor(db,A);await rpc(db,'cs_workout',['start',{id:second,activity_key:'gym',started_at:new Date().toISOString(),started_by:'button'}]);
  await actor(db,B);assert.deepEqual(await rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),{cheered:true});
  assert.equal(await count(db,"select count(*)::int n from classstreak.inbox i join classstreak.users u on u.id=i.user_id where u.auth_id=$1 and i.kind='cheer' and i.from_user=$2",[A,b.profile.id]),1);
  // Strangers cannot cheer, and sharing off hides the workout from cheers too.
  await db.query("insert into auth.users values('00000000-0000-4000-8000-000000000009')");
  await actor(db,'00000000-0000-4000-8000-000000000009');await rpc(db,'cs_bootstrap',[{first_name:'Dan',selected:['gym'],goals:{gym:1}}]);
  await assert.rejects(rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),/FORBIDDEN/);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_live:false}]);
  await actor(db,C);await assert.rejects(rpc(db,'cs_workout',['cheer',{id:a.profile.id}]),/NOT_WORKING_OUT/);
 }finally{await db.close();}
});
