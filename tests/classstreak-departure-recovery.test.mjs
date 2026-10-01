import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';

test('GPS-confirmed missed exits are estimated, idempotent and bound to the original arrival and timer start',async()=>{
 const db=await fresh();try{
  await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'A',selected:['custom:Climbing'],goals:{'custom:Climbing':2},location_consent:true}]);
  const snap=await rpc(db,'cs_settings',['place',{name:'Climbing gym',activity_key:'custom:Climbing',lat:0,lng:0,radius_m:100}]);const place=snap.places[0];
  const capture=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
  await db.exec("reset role;update classstreak.tracking_devices set started_at=now()-interval '4 hours'");await actor(db,A);
  const clock=Date.now();const at=minutes=>new Date(clock-minutes*60000).toISOString();
  const event=(kind,minutes,fields={})=>({event_id:randomUUID(),place_id:place.id,kind,source:'geofence',observed_at:at(minutes),...fields});
  const first=event('ENTER',180),recovered=event('EXIT',120,{recovered:true,visit_id:first.event_id,workout_started_at:first.observed_at});
  await rpc(db,'cs_ingest',[[event('EXIT',181),first,recovered],capture.token]);
  await rpc(db,'cs_ingest',[[recovered],capture.token]);
  let result=await rpc(db,'cs_snapshot');assert.equal(result.sessions.length,1);assert.equal(result.sessions[0].estimated,true);assert.equal(result.sessions[0].counted,true);assert.equal(Date.parse(result.sessions[0].ended_at),Date.parse(recovered.observed_at));
  const second=event('ENTER',90);await rpc(db,'cs_ingest',[[second],capture.token]);
  const stale=event('EXIT',60,{recovered:true,visit_id:first.event_id,workout_started_at:first.observed_at});await rpc(db,'cs_ingest',[[stale],capture.token]);
  const restart=event('RESTART',55,{visit_id:second.event_id});await rpc(db,'cs_ingest',[[restart],capture.token]);
  await rpc(db,'cs_ingest',[[event('EXIT',30,{recovered:true,visit_id:second.event_id,workout_started_at:second.observed_at})],capture.token]);
  await db.exec('reset role');let row=(await db.query('select * from classstreak.visit_candidates where place_id=$1',[place.id])).rows[0];assert.equal(row.arrival_id,second.event_id);assert.equal(new Date(row.entered_at).getTime(),Date.parse(restart.observed_at));
  const region=(await db.query('select outside_seen from classstreak.region_state where place_id=$1',[place.id])).rows[0];assert.equal(region.outside_seen,false);
  await actor(db,A);const next=event('EXIT',20,{recovered:true,visit_id:second.event_id,workout_started_at:restart.observed_at});await rpc(db,'cs_ingest',[[next],capture.token]);result=await rpc(db,'cs_snapshot');assert.equal(result.sessions.length,2);
  await assert.rejects(rpc(db,'cs_ingest',[[event('EXIT',1,{recovered:true,visit_id:randomUUID(),workout_started_at:at(2)})],randomUUID()]),/CAPTURE_EXPIRED/);
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'B',selected:['gym'],goals:{gym:1},location_consent:true}]);await rpc(db,'cs_settings',['place',{name:'Other gym',activity_key:'gym',lat:1,lng:1,radius_m:100}]);const other=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
  await assert.rejects(rpc(db,'cs_ingest',[[event('EXIT',0,{recovered:true,visit_id:first.event_id,workout_started_at:first.observed_at})],other.token]),/FORBIDDEN/);
 }finally{await db.close();}
});

test('old clients still close normal visits and short recovered visits do not count',async()=>{
 const db=await fresh();try{
  await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'A',selected:['gym'],goals:{gym:2},location_consent:true}]);const snapshot=await rpc(db,'cs_settings',['place',{name:'Gym',activity_key:'gym',lat:0,lng:0,radius_m:100}]);const capture=await rpc(db,'cs_tracking',['start',randomUUID(),null]);
  await db.exec("reset role;update classstreak.tracking_devices set started_at=now()-interval '3 hours'");await actor(db,A);
  const event=(kind,ago,extra={})=>({event_id:randomUUID(),place_id:snapshot.places[0].id,kind,source:'geofence',observed_at:new Date(Date.now()-ago*60000).toISOString(),...extra});
  const short=event('ENTER',50);await rpc(db,'cs_ingest',[[event('EXIT',51),short,event('EXIT',49,{recovered:true,visit_id:short.event_id,workout_started_at:short.observed_at}),event('ENTER',40),event('EXIT',5)],capture.token]);
  const result=await rpc(db,'cs_snapshot');assert.equal(result.sessions.length,1);assert.equal(result.sessions[0].estimated,false);assert.equal(result.sessions[0].counted,true);
 }finally{await db.close();}
});
