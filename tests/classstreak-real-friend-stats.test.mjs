import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';

test('real friend totals, streaks and milestones exclude legacy seeds unless explicitly shared; owned demo peers still work',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'Alice',selected:['reformer'],goals:{reformer:2},tz:'UTC'}]);await rpc(db,'cs_seed_demo',[false,[]]);
  let own=await rpc(db,'cs_snapshot');assert.ok(own.friends.some(f=>f.is_demo&&f.weekly_count>0));
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Bob',selected:['reformer'],goals:{reformer:2},tz:'UTC'}]);const joined=await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);
  await db.exec('reset role');await db.query("update classstreak.friendships set accepted_at=now()-interval '100 days' where $1 in(user_a,user_b) and $2 in(user_a,user_b)",[a.profile.id,joined.profile.id]);
  await actor(db,B);let snapshot=await rpc(db,'cs_snapshot');let peer=snapshot.friends.find(f=>f.id===a.profile.id);
  assert.equal(peer.weekly_count,0);assert.equal(peer.streak,0);assert.deepEqual(peer.days,[]);assert.equal(snapshot.achievements.filter(x=>x.user_id===a.profile.id).length,0);
  // A seed may own the old counted flag on this day; peer totals derive eligible
  // visible sessions and must still include the real workout exactly once.
  await db.exec('reset role');await db.query("insert into classstreak.sessions(user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key) values($1,'reformer','Reformer',now()-interval '1 hour',now()-interval '10 minutes',3000,'geofence',false,(now() at time zone 'UTC')::date,classstreak.monday(now(),'UTC'))",[a.profile.id]);
  await actor(db,B);snapshot=await rpc(db,'cs_snapshot');peer=snapshot.friends.find(f=>f.id===a.profile.id);assert.equal(peer.weekly_count,1);assert.equal(peer.streak,0);assert.equal(peer.days.length,1);
  const realCards=snapshot.achievements.filter(x=>x.user_id===a.profile.id);assert.equal(realCards.length,1);assert.equal(realCards[0].count,1);assert.equal(realCards[0].source,'geofence');assert.equal(Object.keys(realCards[0]).sort().join(','),'count,first_name,id,source,user_id');
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_simulated:true}]);await actor(db,B);snapshot=await rpc(db,'cs_snapshot');peer=snapshot.friends.find(f=>f.id===a.profile.id);assert.ok(peer.weekly_count>1);assert.ok(peer.streak>0);assert.ok(snapshot.achievements.some(x=>x.user_id===a.profile.id&&x.count===10));
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_simulated:false}]);await actor(db,B);snapshot=await rpc(db,'cs_snapshot');assert.equal(snapshot.friends.find(f=>f.id===a.profile.id).weekly_count,1);assert.equal(snapshot.achievements.filter(x=>x.user_id===a.profile.id).length,1);
  await rpc(db,'cs_social',['remove',{id:a.profile.id}]);snapshot=await rpc(db,'cs_snapshot');assert.equal(snapshot.friends.some(f=>f.id===a.profile.id),false);assert.equal(snapshot.achievements.some(x=>x.user_id===a.profile.id),false);
 }finally{await db.close();}
});
