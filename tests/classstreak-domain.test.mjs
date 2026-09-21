import { test } from "node:test";
import assert from "node:assert/strict";
const {draftGoals}=await import("../src/classstreak/model.ts");
test("The pictured three-activity setup has a goal of three, including zero for the hidden gym",()=>{
 const goals=draftGoals(["reformer","yoga","gym"],{});assert.deepEqual(goals,{reformer:2,yoga:1,gym:0});
 assert.equal(Object.values(goals).reduce((a,b)=>a+b,0),3);
});
