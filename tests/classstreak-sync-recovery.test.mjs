import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('capture diagnosis is owner scoped and long dwell survives biased departure speeds',async()=>{
 const db=await fresh();try{
 await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'A',selected:['gym'],goals:{gym:2},location_consent:true}]);const s=await rpc(db,'cs_settings',['place',{name:'Gym',activity_key:'gym',lat:0,lng:0,radius_m:100}]);const d=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
 await db.exec("reset role;update classstreak.tracking_devices set started_at=now()-interval '3 hours'");await actor(db,A);
 assert.equal((await rpc(db,'cs_capture_status',[d.token])).matches,true);assert.equal((await rpc(db,'cs_capture_status',[randomUUID()])).matches,false);
 const e=(kind,ago)=>({event_id:randomUUID(),place_id:s.places[0].id,kind,source:'geofence',observed_at:new Date(Date.now()-ago*60000).toISOString(),median_speed:15});
 const events=[e('EXIT',150),e('ENTER',140),e('EXIT',26)];await rpc(db,'cs_ingest',[events,d.token]);await rpc(db,'cs_ingest',[events,d.token]);
 const snap=await rpc(db,'cs_snapshot');assert.equal(snap.sessions.length,1);assert.equal(snap.sessions[0].counted,true);
 await assert.rejects(rpc(db,'cs_ingest',[[e('EXIT',1)],randomUUID()]),/CAPTURE_EXPIRED/);
 await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'B',selected:['gym'],goals:{gym:2}}]);const other=await rpc(db,'cs_capture_status',[d.token]);assert.equal(other.matches,false);assert.equal(other.started_at,null);
 }finally{await db.close();}
});
