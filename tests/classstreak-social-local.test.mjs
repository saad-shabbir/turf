import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlanning,savePlannedWorkout,planItemsForSync} from '../src/classstreak/planning.ts';
import {creditedEnd,defaultPhotoKind,verifyChoices} from '../src/classstreak/workoutRules.ts';
import {lastWeekLabel} from '../src/classstreak/planLabel.ts';
import {shouldCheckForUpdate,showUpdateBanner,UPDATE_CHECK_INTERVAL} from '../src/classstreak/updateRules.ts';

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


test('last week reads as one simple line',()=>{
 const days=n=>Array.from({length:7},(_,i)=>({done:i<n}));
 assert.equal(lastWeekLabel({days:days(3),planned_days:0,completed_days:0}),'Worked out 3 days');
 assert.equal(lastWeekLabel({days:days(1),planned_days:0,completed_days:0}),'Worked out 1 day');
 assert.equal(lastWeekLabel({days:days(4),planned_days:4,completed_days:3}),'Worked out 3 of 4 planned days');
});

test('update checks run on open and at most every 15 minutes, never in dev or when disabled',()=>{
 const base={enabled:true,dev:false,busy:false};
 assert.equal(shouldCheckForUpdate({...base,now:1000,lastCheck:null}),true);
 assert.equal(shouldCheckForUpdate({...base,now:1000+UPDATE_CHECK_INTERVAL-1,lastCheck:1000}),false);
 assert.equal(shouldCheckForUpdate({...base,now:1000+UPDATE_CHECK_INTERVAL,lastCheck:1000}),true);
 assert.equal(shouldCheckForUpdate({...base,now:500,lastCheck:1000}),true);
 assert.equal(shouldCheckForUpdate({...base,enabled:false,now:1,lastCheck:null}),false);
 assert.equal(shouldCheckForUpdate({...base,dev:true,now:1,lastCheck:null}),false);
 assert.equal(shouldCheckForUpdate({...base,busy:true,now:1,lastCheck:null}),false);
});
test('the restart banner hides during a workout or while the camera is open',()=>{
 assert.equal(showUpdateBanner({ready:true,workoutRunning:false,cameraOpen:false}),true);
 assert.equal(showUpdateBanner({ready:true,workoutRunning:true,cameraOpen:false}),false);
 assert.equal(showUpdateBanner({ready:true,workoutRunning:false,cameraOpen:true}),false);
 assert.equal(showUpdateBanner({ready:false,workoutRunning:false,cameraOpen:false}),false);
});
