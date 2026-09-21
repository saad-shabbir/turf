import { test } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import { fresh, actor, rpc, A, B, C } from "./database-harness.mjs";
const draft = (name="Fixture") => ({first_name:name,last_name:"Tester",selected:["reformer","yoga","gym"],goals:{reformer:2,yoga:1,gym:0},days:[1,3,5],time:"evening",theme:"blush",tz:"America/Los_Angeles",location_consent:true});
export async function setup(db,id=A,name="Fixture") {await actor(db,id);return rpc(db,"cs_bootstrap",[draft(name)]);}
test("ClassStreak setup is atomic, uses authenticated owner, and hidden goals stay zero",async()=>{
 const db=await fresh();try{
  const s=await setup(db); assert.equal(s.profile.first_name,"Fixture");assert.equal(s.goals.reduce((n,g)=>n+g.goal,0),3);assert.equal(s.usual_days.length,3);
  assert.equal(s.profile.auth_id,undefined);assert.equal(s.profile.phone_hash,undefined);
  assert.equal((await rpc(db,"cs_bootstrap",[draft("Changed")])).profile.first_name,"Fixture");
  await actor(db,B);await assert.rejects(()=>rpc(db,"cs_bootstrap",[{...draft(),goals:{reformer:99}}]));
  await assert.rejects(()=>rpc(db,"cs_snapshot"),/SETUP_REQUIRED/);
  await actor(db,null);await assert.rejects(()=>rpc(db,"cs_snapshot"));
 }finally{await db.close();}
});
const ev=(place,kind,at,source="simulated")=>({event_id:randomUUID(),place_id:place,kind,observed_at:at,source});
test("Visit replay, drive-by rejection, per-day counting, correction and manual cap",async()=>{
 const db=await fresh();try{
  await setup(db);const saved=await rpc(db,"cs_settings",["place",{name:"Synthetic Gym",activity_key:"gym",lat:0,lng:0,radius_m:150}]);const p=saved.places[0].id;
  const now=Date.now()-7200000;const t=n=>new Date(now+n*60000).toISOString();
  const drive=[ev(p,"ENTER",t(0)),ev(p,"EXIT",t(2))];await rpc(db,"cs_ingest",[drive,null]);
  assert.equal((await rpc(db,"cs_snapshot")).sessions.length,0);
  const visit=[ev(p,"ENTER",t(10)),ev(p,"EXIT",t(50))];await rpc(db,"cs_ingest",[visit,null]);await rpc(db,"cs_ingest",[visit,null]);
  let s=await rpc(db,"cs_snapshot");assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].duration_sec,2400);assert.equal(s.sessions[0].source,"simulated");
  await rpc(db,"cs_ingest",[[ev(p,"ENTER",t(70)),ev(p,"EXIT",t(100))],null]);s=await rpc(db,"cs_snapshot");assert.equal(s.sessions.filter(x=>x.counted).length,1);
  const first=s.sessions.find(x=>x.counted);await rpc(db,"cs_session",["edit",{id:first.id,workout_label:"Legs"}]);assert.equal((await rpc(db,"cs_snapshot")).sessions.find(x=>x.id===first.id).activity_key,"gym");
  await rpc(db,"cs_session",["remove",{id:first.id}]);assert.equal((await rpc(db,"cs_snapshot")).sessions.filter(x=>x.counted).length,1);
  await rpc(db,"cs_session",["manual",{place_id:p,activity_key:"gym",started_at:t(5),minutes:45}]);
  await assert.rejects(()=>rpc(db,"cs_session",["manual",{place_id:p,activity_key:"gym",started_at:t(6),minutes:45}]),/MANUAL_LIMIT/);
 }finally{await db.close();}
});
test("Simulated clock jumps cannot close a real candidate or use a peer place",async()=>{
 const db=await fresh();try{
  const s=await setup(db);const saved=await rpc(db,"cs_settings",["place",{name:"Synthetic",activity_key:"gym",lat:0,lng:0,radius_m:100}]);const p=saved.places[0].id;
  const device=await rpc(db,"cs_tracking",["start",randomUUID(),null]);const now=Date.now();
  await rpc(db,"cs_ingest",[[ev(p,"EXIT",new Date(now).toISOString(),"geofence"),ev(p,"ENTER",new Date(now+1000).toISOString(),"geofence")],device.token]);
  await rpc(db,"cs_ingest",[[ev(p,"ENTER",new Date(now+7*86400000).toISOString())],null]);
  await db.exec("reset role");const candidates=await db.query("select source from classstreak.visit_candidates where user_id=$1",[s.profile.id]);assert.equal(candidates.rows.length,2);
  await setup(db,B,"Peer");await assert.rejects(()=>rpc(db,"cs_ingest",[[ev(p,"ENTER",new Date().toISOString())],null]),/FORBIDDEN/);
 }finally{await db.close();}
});
test("Private rows cannot be read directly and place writes cannot overwrite another owner",async()=>{
 const db=await fresh();try{
  const a=await setup(db);const p={name:"Synthetic Studio",activity_key:"reformer",lat:0,lng:0,radius_m:100};
  const saved=await rpc(db,"cs_settings",["place",p]);const place=saved.places[0];
  await setup(db,B,"Peer");await assert.rejects(()=>db.query("select * from classstreak.users"));await assert.rejects(()=>db.query("select * from classstreak.places"));
  const peer=await rpc(db,"cs_settings",["place",{...p,id:place.id,name:"Peer place"}]);assert.notEqual(peer.places[0].id,place.id);
  await actor(db,A);const again=await rpc(db,"cs_snapshot");assert.equal(again.places[0].name,"Synthetic Studio");assert.equal(again.profile.id,a.profile.id);
 }finally{await db.close();}
});
test("Goal edits are deferred to next Monday; today's goal is immutable",async()=>{
 const db=await fresh();try{
  await setup(db);const s=await rpc(db,"cs_settings",["goals",{goals:[{activity_key:"gym",goal:4}]}]);
  assert.equal(s.goals.reduce((n,g)=>n+g.goal,0),3);assert.deepEqual(s.pending_goals,[{activity_key:"gym",goal:4}]);
  await actor(db,C);await assert.rejects(()=>rpc(db,"cs_settings",["profile",{first_name:"Other"}]),/SETUP_REQUIRED/);
 }finally{await db.close();}
});
