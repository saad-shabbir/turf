import test from 'node:test';
import assert from 'node:assert/strict';
import {planUpdateTap,applyUpdateNow,updateOutcomeMessage,isUpdateNotification} from '../src/classstreak/updateFlow.ts';
import {toastDuration,isStorageProblem} from '../src/classstreak/toastRules.ts';

test('tapping an update notification reloads only when no workout is running and the camera is closed',()=>{
 assert.equal(planUpdateTap({workoutRunning:false,cameraOpen:false,downloaded:false}),'apply');
 assert.equal(planUpdateTap({workoutRunning:false,cameraOpen:false,downloaded:true}),'reload');
 for(const downloaded of [false,true]){
  assert.equal(planUpdateTap({workoutRunning:true,cameraOpen:false,downloaded}),'background');
  assert.equal(planUpdateTap({workoutRunning:false,cameraOpen:true,downloaded}),'background');
 }
});

const steps=(overrides={})=>{
 const calls=[];
 return {calls,options:{
  enabled:true,
  check:async()=>{calls.push('check');return {isAvailable:true};},
  fetch:async()=>{calls.push('fetch');},
  reload:async()=>{calls.push('reload');},
  timeoutMs:200,
  ...overrides(calls),
 }};
};

test('applying from a tap checks, downloads and reloads',async()=>{
 const {calls,options}=steps(()=>({}));
 assert.equal(await applyUpdateNow(options),'reloaded');assert.deepEqual(calls,['check','fetch','reload']);
});

test('no update means a "latest version" message and no reload',async()=>{
 const {calls,options}=steps(calls=>({check:async()=>{calls.push('check');return {isAvailable:false};}}));
 assert.equal(await applyUpdateNow(options),'latest');assert.deepEqual(calls,['check']);
 assert.deepEqual(updateOutcomeMessage('latest'),{text:'You’re on the latest version',tone:'success'});
});

test('a slow download gives up after the time limit, then shows Restart when it finishes',async()=>{
 let lateReady=0;let finish;
 const {calls,options}=steps(calls=>({fetch:()=>new Promise(resolve=>{calls.push('fetch');finish=resolve;}),timeoutMs:30,onLateReady:()=>{lateReady++;}}));
 assert.equal(await applyUpdateNow(options),'timeout');
 finish();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(lateReady,1);assert.deepEqual(calls,['check','fetch']);
 assert.equal(updateOutcomeMessage('timeout').tone,'info');
});

test('errors and disabled updates never reload',async()=>{
 const failed=steps(calls=>({check:async()=>{calls.push('check');throw new Error('offline');}}));
 assert.equal(await applyUpdateNow(failed.options),'error');assert.deepEqual(failed.calls,['check']);
 assert.equal(updateOutcomeMessage('error').tone,'error');
 const reloadFails=steps(calls=>({reload:async()=>{calls.push('reload');throw new Error('no');}}));
 assert.equal(await applyUpdateNow(reloadFails.options),'error');
 const disabled=steps(()=>({enabled:false}));
 assert.equal(await applyUpdateNow(disabled.options),'unavailable');assert.deepEqual(disabled.calls,[]);
 assert.equal(updateOutcomeMessage('reloaded'),null);
});

test('only update notifications are treated as updates',()=>{
 assert.equal(isUpdateNotification({type:'app_update'}),true);
 for(const data of [null,undefined,{},{pane:'home'},{type:'dm'},'app_update'])assert.equal(isUpdateNotification(data),false);
});

test('toasts stay about 2.5 s, errors about 5 s, longer for long text or VoiceOver',()=>{
 assert.equal(toastDuration('Saved.','success'),2500);
 assert.equal(toastDuration('Comment posted.','info'),2500);
 assert.equal(toastDuration('Please sign in again.','error'),5000);
 assert.ok(toastDuration('Your workout timer ran for 3 hours, so we saved it at 120 minutes. You can edit it in History.','info')>4000);
 assert.ok(toastDuration('x'.repeat(500),'success')<=7000);assert.ok(toastDuration('x'.repeat(500),'error')<=9000);
 assert.equal(toastDuration('Saved.','success',true),5000);
});

test('storage problems stay on screen instead of becoming a toast',()=>{
 assert.equal(isStorageProblem("Could not open this iPhone's saved data. Please report code READ:KEY_MISMATCH. Your data has not been reset."),true);
 assert.equal(isStorageProblem('Saved.'),false);
});
