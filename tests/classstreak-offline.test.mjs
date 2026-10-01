import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A} from './database-harness.mjs';
test('Offline exits from before pause remain uploadable; simulations do not erase real visits',async()=>{
 const db=await fresh();try{
  await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'Fixture',selected:['gym'],goals:{gym:2},location_consent:true}]);const s=await rpc(db,'cs_settings',['place',{name:'Fixture',activity_key:'gym',lat:0,lng:0,radius_m:100}]);const p=s.places[0].id;
  const device=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
  await db.exec('reset role');await db.exec("update classstreak.tracking_devices set started_at=now()-interval '2 hours'");await actor(db,A);
  const event=(kind,minutes,source='geofence')=>({event_id:randomUUID(),place_id:p,kind,source,observed_at:new Date(Date.now()+minutes*60000).toISOString()});
  await rpc(db,'cs_ingest',[[event('EXIT',-70),event('ENTER',-60)],device.token]);
  await rpc(db,'cs_ingest',[[event('ENTER',-60,'simulated'),event('EXIT',-20,'simulated')],null]);
  await rpc(db,'cs_tracking',['stop',null,device.token]);
  await rpc(db,'cs_ingest',[[event('EXIT',-20)],device.token]);const result=await rpc(db,'cs_snapshot');assert.equal(result.sessions.length,2);assert.ok(result.sessions.some(s=>s.source==='geofence'));
  await assert.rejects(()=>rpc(db,'cs_ingest',[[event('ENTER',1)],device.token]),/CAPTURE_EXPIRED/);
 }finally{await db.close();}
});
