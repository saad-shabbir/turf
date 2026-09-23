import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Health matching is opt-in, owner-only, real visits only, and clearing consent removes Health IDs',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'Alice',selected:['gym'],goals:{gym:2}}]);
  const start=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()-1200000).toISOString();
  await db.exec('reset role');
  for(const source of ['geofence','manual','simulated'])await db.query("insert into classstreak.sessions(user_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,week_key,day_key) values($1,'gym','Gym',$2,$3,2400,$4,current_date,current_date)",[a.profile.id,start,end,source]);
  await actor(db,A);const workouts=[{id:randomUUID(),started_at:start,ended_at:end}];
  await assert.rejects(()=>rpc(db,'cs_health',[workouts]),/HEALTH_DISABLED/);
  await rpc(db,'cs_settings',['profile',{health_verify:true}]);assert.equal(await rpc(db,'cs_health',[workouts]),1);
  assert.equal(await rpc(db,'cs_health',[workouts]),0);
  let s=await rpc(db,'cs_snapshot');assert.equal(s.sessions.filter(s=>s.verified).length,1);assert.equal(s.sessions.find(s=>s.verified).source,'geofence');
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Bob',selected:['gym'],goals:{gym:2}}]);await rpc(db,'cs_settings',['profile',{health_verify:true}]);assert.equal(await rpc(db,'cs_health',[workouts]),0);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{health_verify:false}]);s=await rpc(db,'cs_snapshot');assert.ok(s.sessions.every(s=>!s.verified&&!s.health_workout_id));
  await rpc(db,'cs_prepare_delete');await assert.rejects(()=>rpc(db,'cs_snapshot'),/ACCOUNT_DELETING/);await assert.rejects(()=>rpc(db,'cs_settings',['profile',{first_name:'Resurrect'}]),/ACCOUNT_DELETING/);await rpc(db,'cs_prepare_delete');
 }finally{await db.close();}
});
