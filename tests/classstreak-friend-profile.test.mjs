import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';
const setup=async(db,auth,name,tz='UTC')=>{await actor(db,auth);return rpc(db,'cs_bootstrap',[{first_name:name,last_name:'Private',gender:'Woman',selected:['gym'],goals:{gym:2},tz,days:[]}]);};

test('mutual friends can open safe real profiles and an any-day nudge reaches the recipient inbox once',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await actor(db,A);
  await assert.rejects(rpc(db,'cs_friend_profile',[b.profile.id]),/FORBIDDEN/);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await rpc(db,'cs_social',['request',{id:b.profile.id}]);await assert.rejects(rpc(db,'cs_friend_profile',[b.profile.id]),/FORBIDDEN/);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await actor(db,B);await rpc(db,'cs_social',['accept',{id:a.profile.id}]);await actor(db,A);
  let profile=await rpc(db,'cs_friend_profile',[b.profile.id]);assert.equal(profile.nudge_available,true);assert.equal(profile.worked_out_today,false);assert.equal(profile.weekly_count,0);assert.deepEqual(profile.week_details,[]);
  assert.equal(Object.keys(profile).sort().join(','),'first_name,id,is_demo,nudge_available,nudged_today,streak,week_details,weekly_count,weekly_goal,worked_out_today');
  const sent=await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);const peer=sent.friends.find(f=>f.id===b.profile.id);assert.equal(peer.nudged_today,true);assert.equal(peer.nudge_available,false);
  await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);profile=await rpc(db,'cs_friend_profile',[b.profile.id]);assert.equal(profile.nudged_today,true);
  await actor(db,B);const received=await rpc(db,'cs_snapshot');const nudges=received.inbox.filter(i=>i.kind==='nudge');assert.equal(nudges.length,1);assert.match(nudges[0].body,/Alice is cheering you on/);assert.equal(nudges[0].read_at,null);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::integer n from classstreak.nudges where from_user=$1 and to_user=$2',[a.profile.id,b.profile.id])).rows[0].n,1);assert.ok((await db.query('select revision from public.cs_revisions where auth_id=$1',[B])).rows[0].revision>0);
  await actor(db,C);await rpc(db,'cs_bootstrap',[{first_name:'Stranger',selected:['gym'],goals:{gym:1}}]);await assert.rejects(rpc(db,'cs_friend_profile',[b.profile.id]),/FORBIDDEN/);await assert.rejects(rpc(db,'cs_friend_profile',[randomUUID()]),/FORBIDDEN/);
  await actor(db,A);await rpc(db,'cs_social',['remove',{id:b.profile.id}]);await assert.rejects(rpc(db,'cs_friend_profile',[b.profile.id]),/FORBIDDEN/);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await actor(db,null);await assert.rejects(rpc(db,'cs_friend_profile',[b.profile.id]),/permission denied/);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/permission denied/);
 }finally{await db.close();}
});

test('recipient preference and any completed real workout block nudges in the recipient timezone; samples and removed workouts do not',async()=>{
 const db=await fresh();try{
  const day=(tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const tz=['Pacific/Kiritimati','Etc/GMT+12'].find(z=>day(z)!==day('UTC'));assert.ok(tz);
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob',tz);await actor(db,A);await rpc(db,'cs_social',['invite',{code:b.profile.invite_code}]);
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{nudge:false}}]);await actor(db,A);assert.equal((await rpc(db,'cs_friend_profile',[b.profile.id])).nudge_available,false);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{nudge:true}}]);await db.exec('reset role');
  const insert=async(source,removed=false)=>db.query("insert into classstreak.sessions(user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key,removed_at) values($1,'boxing','Boxing',now()-interval '1 second',now(),1,$2,false,(now() at time zone 'UTC')::date,classstreak.monday(now(),'UTC'),case when $3::boolean then now() else null end) returning id",[b.profile.id,source,removed]);
  await insert('seed');await insert('simulated');await insert('geofence',true);await actor(db,A);let profile=await rpc(db,'cs_friend_profile',[b.profile.id]);assert.equal(profile.worked_out_today,false);assert.equal(profile.nudge_available,true);
  await db.exec('reset role');const actual=(await insert('geofence')).rows[0].id;await actor(db,A);profile=await rpc(db,'cs_friend_profile',[b.profile.id]);assert.equal(profile.worked_out_today,true);assert.equal(profile.weekly_count,0);assert.equal(profile.nudge_available,false);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  // A workout begun yesterday but completed today also prevents a nudge.
  await db.exec('reset role');await db.query("update classstreak.sessions set started_at=((now() at time zone $2)::date::timestamp at time zone $2)-interval '1 second',ended_at=((now() at time zone $2)::date::timestamp at time zone $2) where id=$1",[actual,tz]);await actor(db,A);assert.equal((await rpc(db,'cs_friend_profile',[b.profile.id])).worked_out_today,true);await assert.rejects(rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await db.exec('reset role');await db.query('update classstreak.sessions set removed_at=now() where id=$1',[actual]);await actor(db,A);assert.equal((await rpc(db,'cs_friend_profile',[b.profile.id])).nudge_available,true);await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);
  await db.exec('reset role');const sent=(await db.query("select sent_on::text as sent_day from classstreak.nudges where from_user=$1 and to_user=$2",[a.profile.id,b.profile.id])).rows[0];assert.equal(sent.sent_day,day(tz));assert.notEqual(sent.sent_day,day('UTC'));
  // A record from yesterday in the recipient's timezone does not consume today.
  await db.query("update classstreak.nudges set sent_on=sent_on-1 where from_user=$1 and to_user=$2",[a.profile.id,b.profile.id]);await actor(db,A);assert.equal((await rpc(db,'cs_friend_profile',[b.profile.id])).nudge_available,true);await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).inbox.filter(i=>i.kind==='nudge').length,2);
 }finally{await db.close();}
});

test('friend profile real workout summaries ignore seed count flags, never expose precise time or private places, and stay real even with simulation sharing',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob');await rpc(db,'cs_seed_demo',[false,[]]);await rpc(db,'cs_settings',['profile',{share_simulated:true}]);await actor(db,A);await rpc(db,'cs_social',['invite',{code:b.profile.invite_code}]);
  await db.exec('reset role');await db.query("update classstreak.friendships set accepted_at=now()-interval '100 days' where user_a=least($1::uuid,$2::uuid) and user_b=greatest($1::uuid,$2::uuid)",[a.profile.id,b.profile.id]);
  await db.query("insert into classstreak.sessions(user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key) values($1,'gym','Weights',now()-interval '40 minutes',now()-interval '10 minutes',1800,'geofence',false,(now() at time zone 'UTC')::date,classstreak.monday(now(),'UTC'))",[b.profile.id]);
  await actor(db,A);const profile=await rpc(db,'cs_friend_profile',[b.profile.id]);assert.equal(profile.weekly_count,1);assert.equal(profile.streak,0);assert.equal(profile.week_details.length,1);assert.equal(profile.week_details[0].workout_label,'Weights');assert.equal(profile.week_details[0].duration_sec,1800);
  assert.equal(Object.keys(profile.week_details[0]).sort().join(','),'activity_key,day,duration_sec,time_of_day,workout_label');
  for(const key of ['auth_id','tz','gender','last_name','place_name','lat','lng','started_at','ended_at','invite_code','notification_preferences'])assert.equal(profile[key],undefined);
  await assert.rejects(db.query('select classstreak.worked_out_today($1)',[b.profile.id]),/permission denied/);await assert.rejects(rpc(db,'cs_social_before_friend_profile',['nudge',{id:b.profile.id}]),/permission denied/);
 }finally{await db.close();}
});
