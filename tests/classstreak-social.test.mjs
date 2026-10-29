import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';

const setup=async(db,auth,name,tz='UTC')=>{await actor(db,auth);return rpc(db,'cs_bootstrap',[{first_name:name,last_name:'Private',selected:['gym'],goals:{gym:2},tz,days:[]}]);};
// Backdate the friendship so sessions from earlier today count as shared, whatever the UTC hour.
const befriend=async(db,a,b)=>{await actor(db,b.auth);await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);await db.exec('reset role');await db.query("update classstreak.friendships set accepted_at=now()-interval '2 days' where status='accepted'");};
const asAdmin=async db=>db.exec('reset role');
const token=n=>`ExponentPushToken[${String(n).padEnd(22,'x')}]`;
const hour=(tz,at=new Date())=>Number(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'}).format(at));
const zones=['UTC','Europe/London','America/New_York','America/Los_Angeles','Pacific/Honolulu','Asia/Tokyo','Asia/Kolkata','Australia/Sydney','Pacific/Kiritimati'];
// A zone where it is daytime now, so "planned 90 minutes ago" is still today and outside quiet hours.
const daytime=()=>zones.find(z=>hour(z)>=9&&hour(z)<=20);
const quiet=()=>zones.find(z=>hour(z)>=23||hour(z)<6);
const localDay=(tz,at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
const localTime=(tz,at)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);

test('direct messages are friends-only, idempotent, readable once and hidden after unfriending',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B};
  await actor(db,A);
  await assert.rejects(rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'Hi',client_id:randomUUID()}]),/FORBIDDEN/);
  await befriend(db,a,b);await actor(db,A);
  const client_id=randomUUID();
  let thread=await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'  Gym at 6?  ',client_id}]);
  await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'  Gym at 6?  ',client_id}]);
  thread=await rpc(db,'cs_messages',['thread',{peer:b.profile.id}]);
  assert.equal(thread.messages.length,1);assert.equal(thread.messages[0].body,'Gym at 6?');assert.equal(thread.messages[0].from_me,true);assert.equal(thread.peer.first_name,'Bob');
  await assert.rejects(rpc(db,'cs_messages',['send',{peer:b.profile.id,body:' ',client_id:randomUUID()}]),/INVALID_MESSAGE/);
  await assert.rejects(rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'x'.repeat(1001),client_id:randomUUID()}]),/INVALID_MESSAGE/);
  await actor(db,B);
  let snap=await rpc(db,'cs_snapshot');assert.equal(snap.dm_unread,1);
  let list=await rpc(db,'cs_messages',['list',{}]);assert.equal(list.length,1);assert.equal(list[0].unread,1);assert.equal(list[0].last_from_me,false);assert.equal(list[0].first_name,'Alice');
  thread=await rpc(db,'cs_messages',['read',{peer:a.profile.id}]);assert.equal(thread.messages[0].from_me,false);assert.equal(thread.messages[0].read,true);assert.equal(thread.messages[0].client_id,null);
  snap=await rpc(db,'cs_snapshot');assert.equal(snap.dm_unread,0);
  // A stranger cannot read or write the thread, and raw tables stay closed.
  await setup(db,C,'Cara');await assert.rejects(rpc(db,'cs_messages',['thread',{peer:a.profile.id}]),/FORBIDDEN/);
  await assert.rejects(db.query('select * from classstreak.messages'),/permission denied/);
  await actor(db,A);await rpc(db,'cs_social',['remove',{id:b.profile.id}]);
  await assert.rejects(rpc(db,'cs_messages',['thread',{peer:b.profile.id}]),/FORBIDDEN/);
  assert.deepEqual(await rpc(db,'cs_messages',['list',{}]),[]);
  await actor(db,null);await assert.rejects(rpc(db,'cs_messages',['list',{}]),/permission denied/);
 }finally{await db.close();}
});

test('push is queued only for registered phones, honours type settings, mutes and quiet hours, and is claimed by the service only',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob',daytime()),auth:B};
  await befriend(db,a,b);
  await actor(db,A);const send=body=>rpc(db,'cs_messages',['send',{peer:b.profile.id,body,client_id:randomUUID()}]);
  await send('No phone yet');
  await asAdmin(db);assert.equal((await db.query('select count(*)::integer n from classstreak.push_outbox')).rows[0].n,0);
  await actor(db,B);
  await assert.rejects(rpc(db,'cs_push_token',['not-a-token',true]),/INVALID_TOKEN/);
  await rpc(db,'cs_push_token',[token(1),true]);
  await actor(db,A);await send('See you there');
  await asAdmin(db);let rows=(await db.query('select * from classstreak.push_outbox')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].title,'Alice');assert.equal(rows[0].body,'See you there');assert.equal(rows[0].data.pane,`dm:${a.profile.id}`);assert.equal(rows[0].data.kind,'dm');
  assert.ok(Date.parse(rows[0].send_after)<=Date.now()+1000);
  // Per-type setting and per-friend mute.
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{dm:false}}]);
  await actor(db,A);await send('Muted by setting');
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{dm:true}}]);
  let snap=await rpc(db,'cs_social',['mute',{id:a.profile.id}]);assert.equal(snap.friends.find(f=>f.id===a.profile.id).muted,true);
  await actor(db,A);await send('Muted friend');
  await asAdmin(db);assert.equal((await db.query('select count(*)::integer n from classstreak.push_outbox')).rows[0].n,1);
  await actor(db,B);snap=await rpc(db,'cs_social',['unmute',{id:a.profile.id}]);assert.equal(snap.friends.find(f=>f.id===a.profile.id).muted,false);
  await actor(db,C);await setup(db,C,'Cara');await assert.rejects(rpc(db,'cs_social',['mute',{id:a.profile.id}]),/FORBIDDEN/);
  // Clients can never drain the queue.
  await actor(db,B);await assert.rejects(rpc(db,'cs_push_claim',[10]),/permission denied/);await assert.rejects(rpc(db,'cs_push_done',[[]]),/permission denied/);
  await asAdmin(db);
  const claimed=await rpc(db,'cs_push_claim',[10]);assert.equal(claimed.length,1);assert.deepEqual(claimed[0].tokens,[token(1)]);
  assert.deepEqual(await rpc(db,'cs_push_claim',[10]),[]);
  await rpc(db,'cs_push_done',[[{id:claimed[0].id,ok:true,invalid_tokens:[token(1)]}]]);
  rows=(await db.query('select sent_at from classstreak.push_outbox')).rows;assert.ok(rows[0].sent_at);
  assert.equal((await db.query('select count(*)::integer n from classstreak.push_tokens')).rows[0].n,0);
  // A token moves with the phone to whoever signs in, and unregistering only removes your own.
  await actor(db,B);await rpc(db,'cs_push_token',[token(2),true]);
  await actor(db,A);await rpc(db,'cs_push_token',[token(2),true]);
  await actor(db,B);await rpc(db,'cs_push_token',[token(2),false]);
  await asAdmin(db);assert.equal((await db.query('select user_id from classstreak.push_tokens')).rows[0].user_id,a.profile.id);
 }finally{await db.close();}
});

test('quiet hours hold a push until 7:00 local time',async()=>{
 const zone=quiet();if(!zone)return;
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob',zone),auth:B};
  await befriend(db,a,b);await actor(db,B);await rpc(db,'cs_push_token',[token(3),true]);
  await actor(db,A);await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'Late one',client_id:randomUUID()}]);
  await asAdmin(db);const row=(await db.query('select send_after from classstreak.push_outbox')).rows[0];
  assert.ok(row.send_after>new Date());assert.equal(localTime(zone,row.send_after),'07:00');
  assert.deepEqual(await rpc(db,'cs_push_claim',[10]),[]);
 }finally{await db.close();}
});

test('profile photos upload under your own avatar folder and are visible to friends and requests only',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B};await setup(db,C,'Cara');
  await actor(db,A);const path=`${A}/avatar/${randomUUID()}.jpg`;
  await assert.rejects(rpc(db,'cs_set_avatar',[path]),/PHOTO_NOT_UPLOADED/);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',`${B}/avatar/${randomUUID()}.jpg`]));
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',`${A}/avatar/me.png`]));
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',path]);
  await assert.rejects(rpc(db,'cs_set_avatar',[`${B}/avatar/${randomUUID()}.jpg`]),/FORBIDDEN/);
  const snap=await rpc(db,'cs_set_avatar',[path]);assert.equal(snap.profile.avatar_path,path);
  const visible=async who=>{await actor(db,who);return (await db.query('select name from storage.objects where name=$1',[path])).rows.length;};
  assert.equal(await visible(B),0);assert.equal(await visible(C),0);
  // Sending a request does not reveal the other person's photo.
  await actor(db,B);let friends=(await rpc(db,'cs_social',['request',{id:a.profile.id}])).friends;assert.equal(await visible(B),0);
  assert.equal(friends.find(f=>f.id===a.profile.id).avatar_path,null);
  await actor(db,A);
  await rpc(db,'cs_social',['accept',{id:b.profile.id}]);
  await actor(db,B);friends=(await rpc(db,'cs_snapshot')).friends;assert.equal(friends.find(f=>f.id===a.profile.id).avatar_path,path);
  assert.equal((await rpc(db,'cs_friend_profile',[a.profile.id])).avatar_path,path);
  assert.equal(await visible(C),0);
  await actor(db,A);assert.equal((await rpc(db,'cs_set_avatar',[null])).profile.avatar_path,null);assert.equal(await visible(B),0);
 }finally{await db.close();}
});

test('weekly plans are shared with friends only, past days are kept as recorded and last week is scored by planned days',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B};await setup(db,C,'Cara');
  await befriend(db,a,b);
  await actor(db,B);
  const mine=await rpc(db,'cs_profile_plan',[null]);const monday=mine.this_week[0].day;
  const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const lastWeek=[0,2,4,5,6].map(n=>({day:shift(monday,n-7),slot:`gym:${n}`,activity_key:'gym',time:'06:00',period:'morning'}));
  await assert.rejects(rpc(db,'cs_plan_sync',[[{day:monday,slot:'x',activity_key:'gym',period:'night'}]]),/INVALID_PLAN/);
  const saved=await rpc(db,'cs_plan_sync',[[...lastWeek,{day:shift(monday,1),slot:'gym:1',activity_key:'gym',time:'18:30',period:'evening'},{day:shift(monday,8),slot:'yoga:1',activity_key:'yoga',time:null,period:'midday'},{day:shift(monday,40),slot:'far',activity_key:'gym',period:'evening'}]]);
  assert.equal(saved.saved,7);
  // Workouts on 4 of the 5 planned days last week; one on an unplanned day.
  await asAdmin(db);
  for(const n of [0,2,4,5,3]){
   const day=shift(monday,n-7);const id=randomUUID();
   await db.query(`insert into classstreak.sessions(id,user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,verified,week_key,day_key,event_key) values($1,$2,'gym','Gym',$3::date+time '07:00',$3::date+time '08:00',3600,'manual',false,$4,$3,$5)`,[id,b.profile.id,day,shift(monday,-7),'test:'+id]);
  }
  await actor(db,B);let plan=await rpc(db,'cs_profile_plan',[null]);
  assert.equal(plan.last_week.planned_days,5);assert.equal(plan.last_week.completed_days,4);assert.equal(plan.last_week.percent,80);
  assert.deepEqual(plan.last_week.days.map(d=>[d.planned.length>0,d.done]),[[true,true],[false,false],[true,true],[false,true],[true,true],[true,true],[true,false]]);
  assert.equal(plan.this_week[1].planned[0].time,'18:30');assert.equal(plan.next_week[1].planned[0].workout_label,'Yoga');
  // After the first sync, earlier days cannot be rewritten.
  await rpc(db,'cs_plan_sync',[[]]);plan=await rpc(db,'cs_profile_plan',[null]);assert.equal(plan.last_week.planned_days,5);
  await actor(db,A);const seen=await rpc(db,'cs_profile_plan',[b.profile.id]);assert.equal(seen.shared,true);assert.equal(seen.last_week.percent,80);
  await actor(db,C);await assert.rejects(rpc(db,'cs_profile_plan',[b.profile.id]),/FORBIDDEN/);
  await actor(db,B);await rpc(db,'cs_settings',['profile',{share_plan:false}]);
  await actor(db,A);assert.deepEqual(await rpc(db,'cs_profile_plan',[b.profile.id]),{shared:false});
  await actor(db,null);await assert.rejects(rpc(db,'cs_profile_plan',[b.profile.id]),/permission denied/);
  await assert.rejects(rpc(db,'cs_plan_sync',[[]]),/permission denied/);
 }finally{await db.close();}
});

test('a friend who has not started an hour after their plan triggers one alert per friend and session, and one extra nudge',async()=>{
 const zone=daytime();assert.ok(zone);
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Sam',zone),auth:B},c={...await setup(db,C,'Cara'),auth:C};
  await befriend(db,a,b);await befriend(db,c,b);
  const planned=new Date(Date.now()-90*60000);const time=localTime(zone,planned);
  await actor(db,B);await rpc(db,'cs_plan_sync',[[{day:localDay(zone),slot:'gym:today',activity_key:'gym',time,period:'evening'}]]);
  await actor(db,C);await rpc(db,'cs_social',['mute',{id:b.profile.id}]);
  // Alice nudged Sam this morning, so only the alert can unlock another nudge.
  await actor(db,A);await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);
  let friend=(await rpc(db,'cs_snapshot')).friends.find(f=>f.id===b.profile.id);assert.equal(friend.nudge_available,false);
  await asAdmin(db);await db.query('select classstreak.social_checks()');await db.query('select classstreak.social_checks()');
  await actor(db,A);let snap=await rpc(db,'cs_snapshot');
  const alerts=snap.inbox.filter(i=>i.kind==='plan_missed');assert.equal(alerts.length,1);
  const [h,m]=time.split(':').map(Number);assert.equal(alerts[0].body,`Sam was planning the gym at ${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'} and hasn’t started. Nudge them?`);
  friend=snap.friends.find(f=>f.id===b.profile.id);assert.equal(friend.nudge_available,true);
  assert.equal((await rpc(db,'cs_friend_profile',[b.profile.id])).nudge_available,true);
  await actor(db,C);assert.equal((await rpc(db,'cs_snapshot')).inbox.filter(i=>i.kind==='plan_missed').length,0);
  await actor(db,A);snap=await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);assert.equal(snap.friends.find(f=>f.id===b.profile.id).nudge_available,false);
  await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);
  await actor(db,B);const nudges=(await rpc(db,'cs_snapshot')).inbox.filter(i=>i.kind==='nudge');assert.equal(nudges.length,2);assert.ok(nudges.some(n=>/saw your plan/.test(n.body)));
  // Sharing off stops alerts about you.
  await rpc(db,'cs_settings',['profile',{share_plan:false}]);await asAdmin(db);await db.query('delete from classstreak.plan_alerts');await db.query('select classstreak.social_checks()');
  assert.equal((await db.query('select count(*)::integer n from classstreak.plan_alerts')).rows[0].n,0);
 }finally{await db.close();}
});

test('no plan alert once the friend has started or logged a workout',async()=>{
 const zone=daytime();assert.ok(zone);
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Sam',zone),auth:B};await befriend(db,a,b);
  await actor(db,B);await rpc(db,'cs_plan_sync',[[{day:localDay(zone),slot:'gym:today',activity_key:'gym',time:localTime(zone,new Date(Date.now()-80*60000)),period:'evening'}]]);
  await rpc(db,'cs_workout',['start',{id:randomUUID(),activity_key:'gym',started_at:new Date().toISOString(),started_by:'button'}]);
  await asAdmin(db);await db.query('select classstreak.social_checks()');
  assert.equal((await db.query('select count(*)::integer n from classstreak.plan_alerts')).rows[0].n,0);
 }finally{await db.close();}
});

test('starting a workout tells friends once, shows them a live card and shared photos, and a forgotten timer closes at 3 hours',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B},c={...await setup(db,C,'Cara'),auth:C};
  await befriend(db,a,b);await befriend(db,a,c);
  await actor(db,C);await rpc(db,'cs_social',['mute',{id:a.profile.id}]);
  await actor(db,A);const id=randomUUID();const started=new Date(Date.now()-60000).toISOString();
  await assert.rejects(rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:new Date(Date.now()-5*3600000).toISOString()}]),/INVALID_WORKOUT/);
  await rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:started,started_by:'photo'}]);
  await rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:started,started_by:'photo'}]);
  await actor(db,B);let snap=await rpc(db,'cs_snapshot');
  assert.equal(snap.inbox.filter(i=>i.kind==='friend_started').length,1);assert.equal(snap.inbox.find(i=>i.kind==='friend_started').body,'Alice just started the gym. Cheer them on?');
  assert.equal(snap.live.length,1);assert.equal(snap.live[0].user_id,a.profile.id);assert.equal(snap.live[0].photo,null);
  // Friends get rough elapsed minutes, never the workout id or exact start.
  assert.equal(snap.live[0].id,undefined);assert.equal(snap.live[0].started_at,undefined);assert.equal(snap.live[0].started_minutes_ago,5);
  await actor(db,C);snap=await rpc(db,'cs_snapshot');assert.equal(snap.inbox.filter(i=>i.kind==='friend_started').length,0);assert.equal(snap.live.length,1);
  // Pre-workout photo: only into your own active workout folder, attached after upload.
  await actor(db,A);const pre=`${A}/${id}/${randomUUID()}.jpg`;
  await assert.rejects(rpc(db,'cs_workout',['photo',{id,path:pre,kind:'pre'}]),/PHOTO_NOT_UPLOADED/);
  await actor(db,B);await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',`${B}/${id}/${randomUUID()}.jpg`]));
  await actor(db,A);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',pre]);
  await assert.rejects(rpc(db,'cs_workout',['photo',{id,path:pre,kind:'during'}]),/FORBIDDEN/);
  snap=await rpc(db,'cs_workout',['photo',{id,path:pre,kind:'pre'}]);assert.equal(snap.active_workout.id,id);
  const canSee=async who=>{await actor(db,who);return (await db.query('select 1 from storage.objects where name=$1',[pre])).rows.length;};
  assert.equal(await canSee(B),1);
  await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).live[0].photo,pre);
  await actor(db,A);await rpc(db,'cs_workout',['share',{path:pre,share:false}]);assert.equal(await canSee(B),0);
  await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).live[0].photo,null);
  await actor(db,A);await rpc(db,'cs_workout',['share',{path:pre,share:true}]);
  await rpc(db,'cs_workout',['ping',{id,at:new Date().toISOString()}]);
  // Forgotten: started 3h05m ago, last used 30 minutes in → credited to the 2-hour mark.
  await asAdmin(db);await db.query(`update classstreak.active_workouts set started_at=now()-interval '185 minutes',last_activity_at=now()-interval '155 minutes' where id=$1`,[id]);
  await db.query('select classstreak.social_checks()');
  assert.equal((await db.query('select count(*)::integer n from classstreak.active_workouts')).rows[0].n,0);
  const session=(await db.query('select * from classstreak.sessions where id=$1',[id])).rows[0];assert.equal(session.duration_sec,7200);assert.equal(session.source,'manual');assert.equal(session.event_key,'button:'+id);
  await actor(db,A);snap=await rpc(db,'cs_snapshot');assert.ok(snap.inbox.some(i=>i.kind==='workout_stopped'&&/saved 120 minutes/.test(i.body)));
  // The phone's own stop for the same timer is a no-op.
  await rpc(db,'cs_timed_session',[{auth_owner:A,id,activity_key:'gym',started_at:started,ended_at:new Date().toISOString()}]);
  assert.equal((await rpc(db,'cs_snapshot')).sessions.filter(s=>s.id===id).length,1);
  await actor(db,B);snap=await rpc(db,'cs_snapshot');assert.equal(snap.live.length,0);
  const item=snap.feed.find(f=>f.id===id);assert.deepEqual(item.photos.map(p=>p.kind),['pre']);assert.equal(item.avatar_path,null);
  assert.equal(await canSee(B),1);
  await actor(db,null);await assert.rejects(rpc(db,'cs_workout',['stop',{id}]),/permission denied/);
 }finally{await db.close();}
});

test('a timer last used after the 2-hour mark is credited to that moment, and a manual stop ends the live card',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B};await befriend(db,a,b);
  await actor(db,A);const id=randomUUID();await rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:new Date().toISOString(),started_by:'button'}]);
  await asAdmin(db);await db.query(`update classstreak.active_workouts set started_at=now()-interval '190 minutes',last_activity_at=now()-interval '40 minutes' where id=$1`,[id]);
  await db.query('select classstreak.social_checks()');
  assert.equal((await db.query('select duration_sec from classstreak.sessions where id=$1',[id])).rows[0].duration_sec,150*60);
  await actor(db,A);const second=randomUUID();await rpc(db,'cs_workout',['start',{id:second,activity_key:'yoga',started_at:new Date().toISOString(),started_by:'photo'}]);
  await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).live[0].workout_label,'Yoga');
  await actor(db,A);await rpc(db,'cs_workout',['stop',{id:second}]);
  await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).live.length,0);
  // Arrival workouts are never closed by the timer rule.
  await actor(db,A);const arrival=randomUUID();await rpc(db,'cs_workout',['start',{id:arrival,activity_key:'gym',started_at:new Date().toISOString(),started_by:'arrival'}]);
  await asAdmin(db);await db.query(`update classstreak.active_workouts set started_at=now()-interval '200 minutes' where id=$1`,[arrival]);await db.query('select classstreak.social_checks()');
  assert.equal((await db.query('select count(*)::integer n from classstreak.sessions where id=$1',[arrival])).rows[0].n,0);
 }finally{await db.close();}
});

test('people search finds discoverable people by name or @handle with their friend status',async()=>{
 const db=await fresh();try{
  await setup(db,A,'Alice');const b={...await setup(db,B,'Samira'),auth:B},c={...await setup(db,C,'Sam'),auth:C};
  for(const who of [A,B,C]){await actor(db,who);const snap=await rpc(db,'cs_settings',['profile',{discoverable:true}]);assert.equal(snap.profile.discoverable_asked,true);}
  await actor(db,B);await assert.rejects(rpc(db,'cs_settings',['profile',{handle:'No Spaces'}]),/HANDLE_INVALID/);
  let snap=await rpc(db,'cs_settings',['profile',{handle:'@Sam_Lifts'}]);assert.equal(snap.profile.handle,'sam_lifts');
  await actor(db,C);await assert.rejects(rpc(db,'cs_settings',['profile',{handle:'sam_lifts'}]),/HANDLE_TAKEN/);
  await actor(db,A);
  assert.deepEqual(await rpc(db,'cs_people_search',['s']),[]);
  let found=await rpc(db,'cs_people_search',['sam']);assert.deepEqual(found.map(p=>p.first_name),['Samira','Sam']);
  assert.deepEqual(Object.keys(found[0]).sort(),['first_name','handle','id','last_initial','rank','status']);assert.equal(found[0].last_initial,'P');assert.equal(found[1].status,'none');
  assert.deepEqual((await rpc(db,'cs_people_search',['@sam_l'])).map(p=>p.id),[b.profile.id]);
  assert.deepEqual(await rpc(db,'cs_people_search',['%']),[]);assert.deepEqual(await rpc(db,'cs_people_search',['sa_']),[]);
  await rpc(db,'cs_social',['request',{id:c.profile.id}]);
  found=await rpc(db,'cs_people_search',['sam']);assert.equal(found.find(p=>p.id===c.profile.id).status,'requested');
  await actor(db,C);assert.equal((await rpc(db,'cs_people_search',['ali']))[0].status,'incoming');
  // Turning discoverability off hides you from strangers, not from existing friends or requests.
  await actor(db,B);await rpc(db,'cs_settings',['profile',{discoverable:false}]);
  await actor(db,A);assert.deepEqual((await rpc(db,'cs_people_search',['sam'])).map(p=>p.first_name),['Sam']);
  // An exact @handle still finds someone who is not discoverable.
  assert.deepEqual((await rpc(db,'cs_people_search',['@sam_lifts'])).map(p=>p.id),[b.profile.id]);
  assert.deepEqual(await rpc(db,'cs_people_search',['@sam_lift']),[]);
  await actor(db,null);await assert.rejects(rpc(db,'cs_people_search',['sam']),/permission denied/);
 }finally{await db.close();}
});

test('saving a timer session from the phone ends its live card and keeps mid-workout photos',async()=>{
 const db=await fresh();try{
  const a={...await setup(db,A,'Alice'),auth:A},b={...await setup(db,B,'Bob'),auth:B};await befriend(db,a,b);
  await actor(db,A);const id=randomUUID();const started=new Date(Date.now()-40*60000).toISOString();
  await rpc(db,'cs_workout',['start',{id,activity_key:'gym',started_at:started,started_by:'button'}]);
  const mid=`${A}/${id}/${randomUUID()}.jpg`;await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',mid]);
  await rpc(db,'cs_workout',['photo',{id,path:mid,kind:'mid',share:true}]);
  await rpc(db,'cs_timed_session',[{auth_owner:A,id,activity_key:'gym',started_at:started,ended_at:new Date().toISOString()}]);
  await actor(db,B);const snap=await rpc(db,'cs_snapshot');assert.equal(snap.live.length,0);assert.deepEqual(snap.feed.find(f=>f.id===id).photos.map(p=>p.kind),['mid']);
  // After the session exists, a post photo can still be added to it.
  await actor(db,A);const post=`${A}/${id}/${randomUUID()}.jpg`;await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',post]);
  const mine=await rpc(db,'cs_workout',['photo',{id,path:post,kind:'post',share:false,caption:'  Done  '}]);
  assert.deepEqual(mine.feed.find(f=>f.id===id).photos.map(p=>[p.kind,p.share_to_feed,p.caption]),[['mid',true,null],['post',false,'Done']]);
  await actor(db,B);assert.deepEqual((await rpc(db,'cs_snapshot')).feed.find(f=>f.id===id).photos.map(p=>p.kind),['mid']);
 }finally{await db.close();}
});
