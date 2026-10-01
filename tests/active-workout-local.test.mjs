import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';
const notices=[];
globalThis.__turfMocks['expo-notifications']={setNotificationHandler:()=>{},getPermissionsAsync:async()=>({granted:true}),scheduleNotificationAsync:async n=>notices.push(n)};
Object.assign(globalThis.__turfMocks['expo-location'],{Accuracy:{Balanced:3},startLocationUpdatesAsync:async()=>{},hasStartedLocationUpdatesAsync:async()=>false,stopLocationUpdatesAsync:async()=>{}});
globalThis.__turfMocks['react-native'].AppState={currentState:'background'};
const local=await import('../src/db/local.ts');
const tracking=await import('../src/classstreak/tracking.ts');
test('offline arrival, choice, restart and stop persist once; departure cannot reopen the stopped workout',async()=>{
 await local.bindOwner('owner-a');native.session={user:{id:'owner-a'},expires_at:Date.now()/1000+3600};native.networkFails=true;
 const place={id:'place-a',name:'Gym',activity_key:'gym',enabled:true,lat:0,lng:0,radius_m:100};
 await local.write('cs:tracking',{owner:'owner-a',token:'token-a',paused:false,places:[place],candidate:null,simulated:null,outside:[],epoch:0});
 const e=(id,kind)=>({event_id:id,place_id:place.id,kind,source:'geofence',observed_at:new Date(Date.now()-60000).toISOString()});
 await tracking.receiveEvent(e('initial','ENTER'));assert.equal(notices.length,0);
 await tracking.receiveEvent(e('outside','EXIT'));await tracking.receiveEvent(e('arrival','ENTER'));assert.equal(notices.length,1);assert.equal(notices[0].content.data.pane,'active-workout');
 await tracking.receiveEvent(e('arrival','ENTER'));assert.equal(notices.length,1);
 await tracking.controlWorkout('SELECT','arrival','custom:Climbing');assert.equal((await tracking.trackingState()).candidate.workout_label,'Climbing');
 const before=Date.now();await tracking.controlWorkout('RESTART','arrival');assert.ok(Date.parse((await tracking.trackingState()).candidate.entered_at)>=before);
 await tracking.controlWorkout('STOP','arrival');assert.equal((await tracking.trackingState()).candidate,null);
 await assert.rejects(tracking.controlWorkout('STOP','arrival'),/already ended/);
 await tracking.receiveEvent(e('inside-again','ENTER'));assert.equal((await tracking.trackingState()).candidate,null);assert.equal(notices.length,1);
 await tracking.receiveEvent(e('departure','EXIT'));assert.equal((await tracking.trackingState()).candidate,null);
 const rows=await(await local.database()).getAllAsync('SELECT payload FROM cs_outbox ORDER BY seq');const events=rows.map(r=>JSON.parse(r.payload));assert.deepEqual(events.filter(e=>['SELECT','RESTART','STOP'].includes(e.kind)).map(e=>e.kind),['SELECT','RESTART','STOP']);
});

