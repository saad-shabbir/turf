import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('arrival controls survive batched replay, restart time, custom choice and stop before departure',async()=>{
 const db=await fresh();try{
 await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'Fixture',selected:['gym'],goals:{gym:2},location_consent:true}]);
 const s=await rpc(db,'cs_settings',['place',{name:'Gym',activity_key:'gym',lat:0,lng:0,radius_m:100}]);const place_id=s.places[0].id;
 const d=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
 await db.exec("reset role;update classstreak.tracking_devices set started_at=now()-interval '4 hours'");await actor(db,A);
 const e=(kind,min,patch={})=>({event_id:randomUUID(),place_id,kind,source:'geofence',observed_at:new Date(Date.now()+min*60000).toISOString(),...patch});
 const enter=e('ENTER',-65);const edit=e('SELECT',-62,{visit_id:enter.event_id,activity_key:'custom:Climbing'});const restart=e('RESTART',-55,{visit_id:enter.event_id});const stop=e('STOP',-20,{visit_id:enter.event_id});
 const batch=[e('EXIT',-70),enter,edit,restart,stop];
 const r=await rpc(db,'cs_ingest',[batch,d.token]);assert.equal(r.created.length,1);
 await rpc(db,'cs_ingest',[batch,d.token]);
 await rpc(db,'cs_ingest',[[e('ENTER',-19),e('EXIT',-18),e('STOP',-17,{visit_id:enter.event_id})],d.token]);
 let snap=await rpc(db,'cs_snapshot');assert.equal(snap.sessions.length,1);let session=snap.sessions[0];assert.equal(session.activity_key,'custom:Climbing');assert.equal(session.workout_label,'Climbing');assert.equal(Date.parse(session.started_at),Date.parse(restart.observed_at));assert.ok(Math.abs(session.duration_sec-2100)<=1);assert.equal(session.counted,true);
 const second=e('ENTER',-10);await rpc(db,'cs_ingest',[[second,e('STOP',-9,{visit_id:enter.event_id}),e('SELECT',-8,{visit_id:second.event_id,activity_key:'barre'}),e('STOP',-5,{visit_id:second.event_id})],d.token]);
 snap=await rpc(db,'cs_snapshot');assert.equal(snap.sessions.length,2);session=snap.sessions.find(x=>x.activity_key==='barre');assert.equal(session.counted,false);assert.ok(session.duration_sec<=301);
 await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Other',selected:['gym'],goals:{gym:2}}]);
 await assert.rejects(()=>rpc(db,'cs_ingest',[[e('STOP',-1,{visit_id:second.event_id})],d.token]),/CAPTURE_EXPIRED|FORBIDDEN/);
 }finally{await db.close();}
});

