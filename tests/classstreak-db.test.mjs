import { test } from "node:test";
import assert from "node:assert/strict";
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
