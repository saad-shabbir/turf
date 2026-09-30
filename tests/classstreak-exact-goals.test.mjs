import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';

test('exact goals accept five and seven; edits begin next week and invalid eight rolls back atomically',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'Five',selected:['gym'],goals:{gym:5},tz:'UTC'}]);assert.equal(a.goals[0].goal,5);
  const edited=await rpc(db,'cs_settings',['goals',{goals:[{activity_key:'gym',goal:7}]}]);assert.equal(edited.goals[0].goal,5);assert.equal(edited.pending_goals[0].goal,7);
  await assert.rejects(rpc(db,'cs_settings',['goals',{goals:[{activity_key:'gym',goal:8}]}]),/user_activities_goal_check/);
  let snapshot=await rpc(db,'cs_snapshot');assert.equal(snapshot.goals[0].goal,5);assert.equal(snapshot.pending_goals[0].goal,7);
  await actor(db,B);snapshot=await rpc(db,'cs_bootstrap',[{first_name:'Seven',selected:['custom:Climbing'],goals:{'custom:Climbing':7},tz:'UTC'}]);assert.equal(snapshot.goals[0].goal,7);
  await actor(db,C);await assert.rejects(rpc(db,'cs_bootstrap',[{first_name:'Eight',selected:['gym'],goals:{gym:8},tz:'UTC'}]),/user_activities_goal_check/);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::integer n from classstreak.users where auth_id=$1',[C])).rows[0].n,0);
 }finally{await db.close();}
});
