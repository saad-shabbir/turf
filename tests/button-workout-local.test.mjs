import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';
globalThis.__turfMocks['expo-notifications']={setNotificationHandler:()=>{},getPermissionsAsync:async()=>({granted:false}),scheduleNotificationAsync:async()=>{}};
let granted=true,enabled=true,position=null,fail=false;
Object.assign(globalThis.__turfMocks['expo-location'],{Accuracy:{High:6,Balanced:3},getForegroundPermissionsAsync:async()=>({status:granted?'granted':'denied'}),hasServicesEnabledAsync:async()=>enabled,getCurrentPositionAsync:async()=>{if(fail)throw new Error('GPS unavailable');return position;}});
globalThis.__turfMocks['react-native'].AppState={currentState:'background'};
const local=await import('../src/db/local.ts');const buttons=await import('../src/classstreak/buttonWorkout.ts');const tracking=await import('../src/classstreak/tracking.ts');
const place={id:'gym-a',name:'Gym',activity_key:'gym',enabled:true,lat:0,lng:0,radius_m:100};
const snapshot={profile:{id:'profile-a'},places:[place]};
async function setup(){await local.bindOwner('auth-a');native.session={user:{id:'auth-a'},expires_at:Date.now()/1000+3600};native.networkFails=true;native.rpcHandler=null;granted=true;enabled=true;fail=false;position={timestamp:Date.now(),coords:{latitude:0,longitude:0,accuracy:10}};await local.write('cs:snapshot',{auth:'auth-a',value:snapshot});await local.write('cs:button_workout',null);await local.write('cs:button_pending',[]);await local.write('cs:tracking',{owner:'auth-a',token:'capture',paused:false,candidate:null,places:[place],outside:[],epoch:1});}
test('Start requires a fresh accurate position inside a saved place while location is enabled',async()=>{
 await setup();for(const fix of [{...position,coords:{...position.coords,latitude:1}},{...position,coords:{...position.coords,accuracy:150}},{...position,timestamp:Date.now()-60000}]){position=fix;await assert.rejects(()=>buttons.startButtonWorkout(snapshot,'gym'));assert.equal(await buttons.buttonWorkout(),null);}
 await setup();fail=true;await assert.rejects(()=>buttons.startButtonWorkout(snapshot,'gym'),/GPS unavailable/);assert.equal(await buttons.buttonWorkout(),null);
 await setup();const c=await buttons.startButtonWorkout(snapshot,'gym');assert.equal(c.place_id,place.id);assert.equal(c.source,'manual');assert.equal((await buttons.startButtonWorkout(snapshot,'boxing')).visit_id,c.visit_id);
});
test('location-off start persists, Stop queues offline once, and foreground sync uses a stable id',async()=>{
 await setup();granted=false;const c=await buttons.startButtonWorkout(snapshot,'boxing');assert.equal(c.place_id,'');assert.equal(c.workout_label,'Boxing');
 await tracking.receiveEvent({event_id:'auto',place_id:place.id,kind:'ENTER',source:'geofence',observed_at:new Date().toISOString()});assert.equal((await tracking.trackingState()).candidate,null);
 await buttons.controlButtonWorkout('SELECT',c.visit_id,'custom:Climbing');assert.equal((await buttons.buttonWorkout()).candidate.workout_label,'Climbing');
 const w=await buttons.buttonWorkout();await local.write('cs:button_workout',{...w,candidate:{...w.candidate,entered_at:new Date(Date.now()-120000).toISOString()}});
 assert.equal(await buttons.controlButtonWorkout('STOP',c.visit_id),true);assert.equal(await buttons.buttonWorkout(),null);assert.equal((await local.read('cs:button_pending',[])).length,1);
 assert.equal(await buttons.controlButtonWorkout('STOP',c.visit_id),false);
 native.networkFails=false;const uploads=[];native.rpcHandler=async(name,args)=>{uploads.push({name,args});return {};};await buttons.syncButtonWorkouts();assert.equal(uploads[0].name,'cs_timed_session');assert.equal(uploads[0].args.payload.id,c.visit_id);assert.deepEqual(await local.read('cs:button_pending',[]),[]);
});
test('an existing automatic timer is reused and another account cannot start from stale cached data',async()=>{
 await setup();const c={visit_id:'arrival',place_id:place.id,activity_key:'gym',workout_label:'Weights',source:'geofence',entered_at:new Date(Date.now()-1000).toISOString(),lat:0,lng:0,radius_m:100};await local.write('cs:tracking',{...(await tracking.trackingState()),candidate:c});const reused=await buttons.startButtonWorkout(snapshot,'boxing');assert.equal(reused.visit_id,'arrival');assert.equal(await buttons.buttonWorkout(),null);
 await setup();await local.write('cs:snapshot',{auth:'another-owner',value:snapshot});await assert.rejects(()=>buttons.startButtonWorkout(snapshot,'gym'),/AUTH_REQUIRED/);
});
