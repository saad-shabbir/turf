import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlanning,savePlannedWorkout,planItemsForSync} from '../src/classstreak/planning.ts';
import {creditedEnd,defaultPhotoKind,verifyChoices} from '../src/classstreak/workoutRules.ts';

test('plan sync covers last, this and next week with exact times only when set',()=>{
 let plan=emptyPlanning();
 plan=savePlannedWorkout(plan,{id:'gym:1',day:'2026-10-27',activity_key:'gym',time:'06:00',period:'morning',focus:'',reminder:true,recurring:true,changed:false},true);
 plan=savePlannedWorkout(plan,{id:'yoga:once',day:'2026-11-05',activity_key:'yoga',time:null,period:'evening',focus:'',reminder:true,recurring:false,changed:true},false);
 const items=planItemsForSync(plan,'2026-10-26');
 assert.deepEqual(items.filter(i=>i.slot==='gym:1').map(i=>i.day),['2026-10-20','2026-10-27','2026-11-03']);
 assert.deepEqual(items.find(i=>i.slot==='yoga:once'),{day:'2026-11-05',slot:'yoga:once',activity_key:'yoga',time:null,period:'evening'});
 assert.equal(items.find(i=>i.slot==='gym:1').time,'06:00');
});

test('a forgotten timer is credited to the later of 2 hours and the last activity, capped at 3 hours',()=>{
 const start=0,h=3600000;
 assert.equal(creditedEnd(start,null),2*h);assert.equal(creditedEnd(start,.5*h),2*h);assert.equal(creditedEnd(start,2.5*h),2.5*h);assert.equal(creditedEnd(start,5*h),3*h);
});
test('photo kind defaults from the timer',()=>{
 const m=60000;
 assert.equal(defaultPhotoKind(null,0),'pre');assert.equal(defaultPhotoKind(0,10*m),'mid');assert.equal(defaultPhotoKind(0,30*m),'post');assert.equal(defaultPhotoKind(0,m,true),'post');
 assert.deepEqual(verifyChoices(false),['pre']);assert.deepEqual(verifyChoices(true),['mid','post']);
});
