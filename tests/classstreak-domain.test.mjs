import { test } from "node:test";
import assert from "node:assert/strict";
const {draftGoals}=await import("../src/classstreak/model.ts");
test("The pictured three-activity setup has a goal of three, including zero for the hidden gym",()=>{
 const goals=draftGoals(["reformer","yoga","gym"],{});assert.deepEqual(goals,{reformer:2,yoga:1,gym:0});
 assert.equal(Object.values(goals).reduce((a,b)=>a+b,0),3);
});
const {evaluateVisit,progress,mondayKey}=await import("../src/classstreak/engine.ts");
const candidate={place_id:"fixture",activity_key:"reformer",workout_label:"Reformer",entered_at:"2026-09-21T17:00:00Z",source:"simulated",lat:0,lng:0,radius_m:100};
test("Real and simulated visit evaluation rejects drive-bys, fast movement and short stays",()=>{
 assert.equal(evaluateVisit(candidate,"2026-09-21T17:02:00Z").qualifies,false);
 assert.equal(evaluateVisit(candidate,"2026-09-21T17:34:59Z").qualifies,false);
 assert.equal(evaluateVisit(candidate,"2026-09-21T17:35:00Z").qualifies,true);
 const fixes=[1,2,3].map(i=>({timestamp:Date.parse(candidate.entered_at)+i*1000,latitude:0,longitude:0,accuracy:20,speed:3}));
 assert.equal(evaluateVisit(candidate,"2026-09-21T17:40:00Z",fixes).qualifies,false);
 assert.equal(evaluateVisit(candidate,"2026-09-21T17:40:00Z",fixes.map(f=>({...f,accuracy:150}))).qualifies,true);
 assert.equal(evaluateVisit(candidate,"2026-09-21T21:00:00Z",[],true).estimated,true);
});
test("Weeks use local Monday and an unfinished current week does not break a streak",()=>{
 assert.equal(mondayKey("2026-09-21T01:00:00Z","America/Los_Angeles"),"2026-09-14");
 const weeks=[{week_key:"2026-09-14",goal:1,goals:[],tz:"America/Los_Angeles"}];
 const s={id:"1",activity_key:"reformer",started_at:"2026-09-15T12:00:00Z",week_key:"2026-09-14",day_key:"2026-09-15",counted:true,removed_at:null};
 assert.equal(progress([s],weeks,[],"America/Los_Angeles",new Date("2026-09-22T12:00:00Z")).streak,1);
 assert.equal(progress([s],weeks,[],"America/Los_Angeles",new Date("2026-09-29T12:00:00Z")).streak,0);
});

test("Location storage excludes fixes outside the saved arrival area and expired observations",async()=>{
 const {retainedVisitFixes}=await import("../src/classstreak/engine.ts");const now=Date.now();
 const inside={timestamp:now-1000,latitude:0,longitude:0,accuracy:20,speed:0};
 const result=retainedVisitFixes([inside,{...inside,latitude:1},{...inside,timestamp:now-7200001},{...inside,accuracy:500},{...inside,timestamp:now+1000}],{lat:0,lng:0,radius_m:100},now);
 assert.deepEqual(result,[inside]);
 assert.equal(evaluateVisit({...candidate,activity_key:'custom:Climbing'},"2026-09-21T17:24:59Z").qualifies,false);
 assert.equal(evaluateVisit({...candidate,activity_key:'custom:Climbing'},"2026-09-21T17:25:00Z").qualifies,true);
});
