import test from 'node:test';
import assert from 'node:assert/strict';
import './native-harness.mjs';

globalThis.__turfMocks['react-native'].AppState={currentState:'active'};
const appState=globalThis.__turfMocks['react-native'].AppState;
const local=await import('../src/db/local.ts');
const {workoutActivityDriver:driver}=await import('../src/classstreak/workoutLiveActivityNative.ts');
const {syncWorkoutLiveActivity:sync,clearWorkoutLiveActivity:clear}=await import('../src/classstreak/workoutLiveActivity.ts');
const {dayKey,mondayKey}=await import('../src/classstreak/engine.ts');

const instances=new Map(),calls=[];let sequence=0,updateGate=null,updateBegan=null;
driver.supported=true;
driver.list=()=>[...instances.values()];
driver.start=(props,staleDate)=>{
 const id=`native-${++sequence}`;
 const instance={getId:()=>id,props,staleDate,
  update:async(value,stale)=>{calls.push(['update',id,value]);updateBegan?.();if(updateGate)await updateGate;instance.props=value;instance.staleDate=stale;},
  end:async policy=>{calls.push(['end',id,policy]);instances.delete(id);}};
 calls.push(['start',id,props]);instances.set(id,instance);return instance;
};
const initialCandidate=()=>({visit_id:'arrival-one',place_id:'gym',activity_key:'gym',workout_label:'Weights',entered_at:new Date(Date.now()-20*60000).toISOString(),source:'geofence',lat:0,lng:0,radius_m:100});
const makeSnapshot=()=>({profile:{id:'profile-a',first_name:'Test',tz:'UTC',theme:'clay'},goals:[{activity_key:'gym',goal:3}],weeks:[],sessions:[],friends:[],feed:[],server_time:new Date().toISOString()});
async function prepare(){
 await clear();await local.purge();await local.write('auth_blocked',false);
 const state={owner:'auth-a',paused:false,candidate:initialCandidate()};const snapshot=makeSnapshot();
 await local.write('cs:tracking',{...state,candidate:null});await local.write('cs:snapshot',{auth:'auth-a',value:snapshot});
 await sync({resume:true});await local.write('cs:tracking',state);
 appState.currentState='active';calls.length=0;return {state,snapshot};
}

test('Background arrival remains pending; opening starts one card with the saved arrival time',async()=>{
 const {state}=await prepare();appState.currentState='background';await sync();
 assert.equal(instances.size,0);assert.equal(await local.read('cs:live_activity_status',''),'pending');
 appState.currentState='active';await sync();await sync();
 assert.equal(instances.size,1);assert.equal(calls.filter(x=>x[0]==='start').length,1);assert.equal(calls.filter(x=>x[0]==='update').length,0);
 const current=[...instances.values()][0];assert.equal(current.props.startedAt,Date.parse(state.candidate.entered_at));assert.equal(current.staleDate.getTime(),current.props.startedAt+4*3600000);assert.equal(await local.read('cs:live_activity_status',''),'active');
});

test('Workout picker and timer restart update the same native activity, including in background',async()=>{
 const {state}=await prepare();await sync();const id=[...instances.keys()][0];
 state.candidate={...state.candidate,activity_key:'boxing',workout_label:'Boxing'};await local.write('cs:tracking',state);appState.currentState='background';await sync();
 assert.equal(instances.get(id).props.label,'Boxing');
 state.candidate.entered_at=new Date(Date.now()-60000).toISOString();await local.write('cs:tracking',state);await sync();
 assert.equal(instances.get(id).props.startedAt,Date.parse(state.candidate.entered_at));assert.equal(calls.filter(x=>x[0]==='start').length,1);assert.equal(calls.filter(x=>x[0]==='update').length,2);
});

test('Stop, departure, pause, and auth/cache mismatch clear the card and saved binding',async()=>{
 for(const reason of ['stopped','paused','wrong-cache','logged-out']){
  const {state}=await prepare();await sync();
  if(reason==='stopped')state.candidate=null;
  if(reason==='paused')state.paused=true;
  if(reason==='wrong-cache')await local.write('cs:snapshot',{auth:'another-owner',value:makeSnapshot()});
  if(reason==='logged-out')await local.write('auth_blocked',true);
  await local.write('cs:tracking',state);await sync();
  assert.equal(instances.size,0,reason);assert.equal(await local.read('cs:live_activity','missing'),null);assert.equal(await local.read('cs:live_activity_status',''),'none');
 }
});

test('Weekly progress excludes old samples and simulations, including legacy sample-owned counted flags',async()=>{
 const {snapshot}=await prepare();const now=new Date();
 const session={id:'real',user_id:'profile-a',activity_key:'gym',workout_label:'Weights',source:'geofence',duration_sec:3600,started_at:new Date(now.getTime()-7200000).toISOString(),ended_at:new Date(now.getTime()-3600000).toISOString(),day_key:dayKey(now,'UTC'),week_key:mondayKey(now,'UTC'),counted:false};
 snapshot.sessions=[{...session,id:'seed',source:'seed',counted:true},{...session,id:'simulated',source:'simulated',counted:true},{...session,id:'other-owner',user_id:'profile-b',activity_key:'boxing',counted:true},session];
 await local.write('cs:snapshot',{auth:'auth-a',value:snapshot});await sync();
 assert.equal([...instances.values()][0].props.count,1);assert.equal([...instances.values()][0].props.goal,3);
});

test('An account switch during an awaited native update ends the old card; clear cancels queued work',async()=>{
 const {state}=await prepare();await sync();state.candidate.workout_label='Yoga';await local.write('cs:tracking',state);
 let release;updateGate=new Promise(resolve=>{release=resolve;});const began=new Promise(resolve=>{updateBegan=resolve;});
 const updating=sync();await began;const queued=sync();const clearing=clear();
 await local.purge();release();await Promise.all([updating,queued,clearing]);updateGate=null;updateBegan=null;
 assert.equal(instances.size,0);assert.equal(calls.filter(x=>x[0]==='start').length,1);assert.equal(await local.read('cs:live_activity',null),null);assert.equal(await local.read('cs:live_activity_status',''),'none');
});

test('Clear ends native activities even when saved storage is unreadable',async()=>{
 await prepare();await sync();const db=await local.database(),run=db.runAsync;db.runAsync=async()=>{throw new Error('STORAGE_ERROR');};
 try{await clear();assert.equal(instances.size,0);}finally{db.runAsync=run;}
});

test('Clear stays suspended until explicit authenticated resume; background callbacks cannot revive it',async()=>{
 await prepare();await sync();await clear();
 appState.currentState='background';await sync();appState.currentState='active';await sync();
 assert.equal(instances.size,0);assert.equal(await local.read('cs:live_activity_status',''),'none');
 await local.write('auth_blocked',true);await sync({resume:true});assert.equal(instances.size,0);
 await local.write('auth_blocked',false);await local.write('cs:snapshot',{auth:'wrong-account',value:makeSnapshot()});await sync({resume:true});assert.equal(instances.size,0);
 await local.write('cs:snapshot',{auth:'auth-a',value:makeSnapshot()});await sync();assert.equal(instances.size,0);
 await sync({resume:true});assert.equal(instances.size,1);assert.equal(await local.read('cs:live_activity_status',''),'active');
});

test('A manually dismissed card stays dismissed for that visit, but a new arrival can start one',async()=>{
 const {state}=await prepare();await sync();const binding=await local.read('cs:live_activity',null);instances.delete(binding.id);
 await sync();await sync({resume:true});state.candidate.workout_label='Boxing';await local.write('cs:tracking',state);await sync();
 assert.equal(instances.size,0);assert.equal(await local.read('cs:live_activity_status',''),'dismissed');assert.equal(calls.filter(x=>x[0]==='start').length,1);assert.deepEqual(await local.read('cs:live_activity',null),binding);
 state.candidate.visit_id='new-arrival';await local.write('cs:tracking',state);await sync();assert.equal(instances.size,1);assert.equal(calls.filter(x=>x[0]==='start').length,2);
});

test('Simulations, invalid/future/expired arrivals cannot expose a live workout',async()=>{
 for(const patch of [{source:'simulated'},{entered_at:'invalid'},{entered_at:new Date(Date.now()+60000).toISOString()},{entered_at:new Date(Date.now()-5*3600000).toISOString()}]){
  const {state}=await prepare();Object.assign(state.candidate,patch);await local.write('cs:tracking',state);await sync();assert.equal(instances.size,0);
 }
});

test('a button-started timer works with automatic tracking paused and clears when stopped',async()=>{
 const {state}=await prepare();await local.write('cs:tracking',{...state,paused:true,candidate:null});
 await local.write('cs:button_workout',{owner:state.owner,candidate:{...state.candidate,source:'manual',place_id:''}});
 await sync();assert.equal(instances.size,1);assert.equal([...instances.values()][0].props.label,'Weights');
 await local.write('cs:button_workout',null);await sync();assert.equal(instances.size,0);
});
