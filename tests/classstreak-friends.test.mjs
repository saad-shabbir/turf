import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';
const setup=async(db,auth,name)=>{await actor(db,auth);return rpc(db,'cs_bootstrap',[{first_name:name,last_name:'Private',gender:'Woman',selected:['gym'],goals:{gym:2},tz:'UTC'}]);};
test('Friend view strips private fields, respects both place toggles, join day, simulations and unfriend',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');const saved=await rpc(db,'cs_settings',['place',{name:'Private pin',activity_key:'gym',lat:0,lng:0,radius_m:100}]);const place=saved.places[0];
  const b=await setup(db,B,'Bob');await setup(db,C,'Carol');await actor(db,B);await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);
  await db.exec('reset role');const now=new Date(Date.now()-3600000).toISOString();const old=new Date(Date.now()-8*86400000).toISOString();
  const insert=async(source,at)=>{return (await db.query("insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key) values($1,$2,$3,'gym','Legs',$4,$4::timestamptz+interval '40 minutes',2400,$5,true,($4::timestamptz at time zone 'UTC')::date,classstreak.monday($4,'UTC')) returning id",[a.profile.id,place.id,place.venue_id,at,source])).rows[0].id;};
  const sid=await insert('geofence',now);await insert('geofence',old);const simulated=await insert('simulated',now);
  await actor(db,B);let feed=(await db.query('select * from public.friend_feed')).rows;assert.equal(feed.length,1);assert.equal(feed[0].id,sid);assert.equal(feed[0].place_name,'Private pin');
  for(const key of ['lat','lng','started_at','ended_at','gender','last_name','auth_id','created_at'])assert.equal(feed[0][key],undefined);
  await assert.rejects(()=>db.query('select * from classstreak.sessions'));await assert.rejects(()=>rpc(db,'cs_snapshot_base'));
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_place_name:false}]);await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).feed[0].place_name,null);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_place_name:true,share_simulated:true}]);await rpc(db,'cs_settings',['place',{...place,share_name:false}]);await actor(db,B);feed=(await rpc(db,'cs_snapshot')).feed;assert.equal(feed.length,2);assert.ok(feed.some(s=>s.id===simulated));assert.ok(feed.every(s=>s.place_name===null));
  await rpc(db,'cs_social',['comment',{session_id:sid,body:'Nice work'}]);await rpc(db,'cs_social',['reaction',{session_id:sid,emoji:'🔥'}]);
  await actor(db,C);await assert.rejects(()=>rpc(db,'cs_social',['comment',{session_id:sid,body:'Intruder'}]),/FORBIDDEN/);
  await actor(db,A);await rpc(db,'cs_social',['remove',{id:b.profile.id}]);await actor(db,B);assert.equal((await rpc(db,'cs_snapshot')).feed.length,0);await assert.rejects(()=>rpc(db,'cs_social',['reaction',{session_id:sid,emoji:'👏'}]),/FORBIDDEN/);
  // An old code cannot silently undo someone else's decision to unfriend.
  const pending=await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);assert.equal(pending.friends[0].status,'pending');assert.equal(pending.feed.length,0);
 }finally{await db.close();}
});
test('Requests need the recipient; contact hashes stay private and matching does not auto-accept',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');await rpc(db,'cs_contacts',['save',[],'+12025550111']);const b=await setup(db,B,'Bob');await rpc(db,'cs_contacts',['save',[],'+12025550112']);
  assert.deepEqual(await rpc(db,'cs_contacts',['match',['+12025550111']]),[{id:a.profile.id,first_name:'Alice'}]);
  const pending=await rpc(db,'cs_social',['request',{id:a.profile.id}]);assert.equal(pending.friends[0].status,'pending');await assert.rejects(()=>rpc(db,'cs_social',['accept',{id:a.profile.id}]),/FORBIDDEN/);
  await actor(db,A);const accepted=await rpc(db,'cs_social',['accept',{id:b.profile.id}]);assert.equal(accepted.friends[0].status,'accepted');assert.equal(accepted.profile.phone_hash,undefined);
  await assert.rejects(()=>db.query('select * from classstreak.secrets'));
  await actor(db,null);await assert.rejects(()=>db.query('select * from public.friend_feed'));
 }finally{await db.close();}
});
