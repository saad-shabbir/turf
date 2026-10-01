import {test} from 'node:test';import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Milestone cards obey friendship revocation and simulation sharing, with no private dates',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'A',selected:['reformer'],goals:{reformer:2},tz:'UTC'}]);await rpc(db,'cs_seed_demo',[false,[]]);
  const own=await rpc(db,'cs_snapshot');assert.ok(own.achievements.some(x=>x.user_id===a.profile.id&&x.count===10));
  await actor(db,B);const b=await rpc(db,'cs_bootstrap',[{first_name:'B',selected:['reformer'],goals:{reformer:2},tz:'UTC'}]);await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);
  assert.equal((await rpc(db,'cs_snapshot')).achievements.length,0);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{share_simulated:true}]);await db.exec('reset role');await db.query("update classstreak.friendships set accepted_at=now()-interval '100 days' where $1 in(user_a,user_b) and $2 in(user_a,user_b)",[a.profile.id,b.profile.id]);
  await actor(db,B);const shared=(await rpc(db,'cs_snapshot')).achievements;assert.ok(shared.some(x=>x.user_id===a.profile.id&&x.count===10));assert.ok(shared.every(x=>Object.keys(x).sort().join(',')==='count,first_name,id,source,user_id'));
  await rpc(db,'cs_social',['remove',{id:a.profile.id}]);assert.equal((await rpc(db,'cs_snapshot')).achievements.length,0);
 }finally{await db.close();}
});
