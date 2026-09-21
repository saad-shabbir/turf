import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
const draft={first_name:'Fixture',selected:['reformer','yoga'],goals:{reformer:2,yoga:1},tz:'America/Los_Angeles'};
test('Demo fixtures have 22 owner sessions and only three scoped demo friends; reload and removal are safe',async()=>{
 const db=await fresh();try{
  await actor(db,A);await rpc(db,'cs_bootstrap',[draft]);const s=await rpc(db,'cs_seed_demo',[false,[]]);assert.equal(s.sessions.length,22);
  const p=await rpc(db,'cs_rollup');assert.equal(p.lifetime,22);assert.equal(p.streak,6);assert.equal(p.count,1);
  assert.equal((await rpc(db,'cs_seed_demo',[false,[]])).sessions.length,22);
  await db.exec('reset role');const names=(await db.query('select first_name from classstreak.users where is_demo order by first_name')).rows.map(r=>r.first_name);assert.deepEqual(names,['Jess','Maya','Priya']);
  await actor(db,B);await rpc(db,'cs_bootstrap',[{...draft,first_name:'Peer'}]);await rpc(db,'cs_seed_demo',[true,[]]);
  await actor(db,A);assert.equal((await rpc(db,'cs_snapshot')).sessions.length,22);
  const future=await rpc(db,'cs_rollup',[new Date(Date.now()+14*86400000).toISOString()]);assert.equal(future.streak,0);assert.equal((await rpc(db,'cs_rollup')).streak,6);
  assert.equal((await rpc(db,'cs_seed_demo',[true,[]])).sessions.length,0);
 }finally{await db.close();}
});
test('Pending timezone applies once and historical zones do not revert it',async()=>{
 const db=await fresh();try{
  await actor(db,A);const s=await rpc(db,'cs_bootstrap',[draft]);await rpc(db,'cs_settings',['timezone',{tz:'America/New_York'}]);assert.equal((await rpc(db,'cs_snapshot')).profile.tz,draft.tz);
  await db.exec('reset role');await db.query("update classstreak.timezone_changes set effective_at=now()-interval '1 second' where user_id=$1",[s.profile.id]);
  await actor(db,A);assert.equal((await rpc(db,'cs_snapshot')).profile.tz,'America/New_York');assert.equal((await rpc(db,'cs_snapshot')).profile.tz,'America/New_York');
  await db.exec('reset role');await db.query('select classstreak.maintenance()');
 }finally{await db.close();}
});
