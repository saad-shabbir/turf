import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';
const notices=[];
let fixesRunning=false,cached=null,current=null,regions=[];
globalThis.__turfMocks['expo-notifications']={setNotificationHandler:()=>{},getPermissionsAsync:async()=>({granted:true}),scheduleNotificationAsync:async n=>notices.push(n)};
Object.assign(globalThis.__turfMocks['expo-location'],{
 Accuracy:{Balanced:3},startLocationUpdatesAsync:async()=>{fixesRunning=true;},hasStartedLocationUpdatesAsync:async()=>fixesRunning,stopLocationUpdatesAsync:async()=>{fixesRunning=false;},
 getLastKnownPositionAsync:async()=>cached,getCurrentPositionAsync:async()=>current,
 startGeofencingAsync:async(_task,value)=>{native.registered=true;regions=value;}
});
globalThis.__turfMocks['react-native'].AppState={currentState:'background'};
const local=await import('../src/db/local.ts');
const tracking=await import('../src/classstreak/tracking.ts');
const {observeDeparture}=await import('../src/classstreak/departureRecovery.ts');
const now=Date.now();
const place={id:'climbing-gym',name:'Climbing gym',activity_key:'custom:Climbing',enabled:true,lat:0,lng:0,radius_m:100};
const candidate={visit_id:'arrival',place_id:place.id,activity_key:place.activity_key,workout_label:'Climbing',entered_at:new Date(now-3600000).toISOString(),source:'geofence',lat:0,lng:0,radius_m:100};
const fix=(timestamp,latitude=.004,accuracy=20)=>({timestamp,latitude,longitude:0,accuracy,speed:15});
const loc=f=>({timestamp:f.timestamp,coords:{latitude:f.latitude,longitude:f.longitude,accuracy:f.accuracy,speed:f.speed,altitude:null,altitudeAccuracy:null,heading:null}});
async function setup(){
 await local.bindOwner('departure-owner');native.session={user:{id:'departure-owner'},expires_at:Date.now()/1000+3600};native.networkFails=true;native.uploads=[];fixesRunning=true;cached=null;current=null;
 const db=await local.database();await db.execAsync('CREATE TABLE IF NOT EXISTS cs_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,token TEXT,payload TEXT NOT NULL);DELETE FROM cs_outbox;');
 await local.write('cs:tracking',{owner:'departure-owner',token:'original-token',paused:false,places:[place],candidate,simulated:null,outside:[],epoch:9});await local.write('cs:fixes',[]);
}
test('departure needs separated fresh fixes outside radius plus uncertainty; ignores drift, stale/future samples and duplicate fixes',()=>{
 assert.equal(observeDeparture(candidate,[fix(now-45000)],null,now).exitedAt,null);
 assert.equal(observeDeparture(candidate,[fix(now-45000),fix(now-10000)],null,now).exitedAt,new Date(now-45000).toISOString());
 for(const samples of [[fix(now-45000),fix(now-45000)],[fix(now-45000),fix(now-35000)],[fix(now-45000,.001),fix(now-10000,.001)],[fix(now-45000,.004,150),fix(now-10000,.004,150)],[fix(now-180000),fix(now-140000)],[fix(now+30000),fix(now+90000)],[fix(now-45000),fix(now-30000,0),fix(now-10000)]])assert.equal(observeDeparture(candidate,samples,null,now).exitedAt,null);
 const prior=observeDeparture(candidate,[fix(now-45000)],null,now).evidence;
 assert.equal(observeDeparture({...candidate,entered_at:new Date(now-20000).toISOString()},[fix(now-10000)],prior,now).exitedAt,null);
});
test('missing native EXIT recovers offline once using the first outside fix; stores no outside route and keeps original capture',async()=>{
 await setup();await tracking.receiveFixes([loc(fix(now-45000))]);assert.ok((await tracking.trackingState()).candidate);
 await tracking.receiveFixes([loc(fix(now-10000))]);assert.equal((await tracking.trackingState()).candidate,null);assert.equal(fixesRunning,false);
 await tracking.receiveFixes([loc(fix(now-10000))]);
 const rows=await(await local.database()).getAllAsync('SELECT token,payload FROM cs_outbox');assert.equal(rows.length,1);assert.equal(rows[0].token,'original-token');
 const e=JSON.parse(rows[0].payload);assert.equal(e.recovered,true);assert.equal(e.visit_id,'arrival');assert.equal(e.observed_at,new Date(now-45000).toISOString());assert.equal(e.workout_started_at,candidate.entered_at);
 assert.deepEqual(await local.read('cs:fixes',[]),[]);assert.equal((await tracking.trackingState()).departure,null);assert.match((await local.read('cs:logs',[])).at(-1).reason,/departure recovered/);
});
test('restart, stop and changed capture reject delayed recovery without creating another session',async()=>{
 await setup();const old={event_id:'old-recovery',place_id:place.id,kind:'EXIT',source:'geofence',recovered:true,visit_id:'arrival',workout_started_at:candidate.entered_at,observed_at:new Date(now-10000).toISOString()};
 await tracking.controlWorkout('RESTART','arrival');await tracking.receiveEvent(old);assert.ok((await tracking.trackingState()).candidate);
 await tracking.controlWorkout('STOP','arrival');await tracking.receiveEvent(old);assert.equal((await tracking.trackingState()).candidate,null);
 assert.equal((await(await local.database()).getAllAsync('SELECT payload FROM cs_outbox')).some(r=>JSON.parse(r.payload).recovered),false);
 await setup();await tracking.receiveFixes([loc(fix(now-45000)),loc(fix(now-10000))],{owner:'departure-owner',token:'wrong-token',epoch:9});assert.ok((await tracking.trackingState()).candidate);
 await tracking.receiveFixes([loc(fix(now-45000)),loc(fix(now-10000))],{owner:'other-owner',token:'original-token',epoch:9});assert.ok((await tracking.trackingState()).candidate);
 await tracking.receiveFixes([loc(fix(now-45000)),loc(fix(now-10000))],{owner:'departure-owner',token:'original-token',epoch:8});assert.ok((await tracking.trackingState()).candidate);
});
test('foreground refresh repairs a missing registration and reconciles cached plus fresh exit without rotating capture',async()=>{
 await setup();native.registered=false;fixesRunning=false;cached=loc(fix(now-45000));current=loc(fix(now-10000));
 await tracking.reconcileTracking();assert.equal(native.registered,true);assert.equal(regions[0].identifier,place.id);assert.equal((await tracking.trackingState()).candidate,null);assert.equal((await tracking.trackingState()).token,'original-token');
});
test('re-registering offline preserves the active visit, epoch, outside evidence and original token',async()=>{
 await setup();await tracking.receiveFixes([loc(fix(now-45000))]);await tracking.startTracking();const state=await tracking.trackingState();
 assert.equal(state.candidate.visit_id,'arrival');assert.equal(state.epoch,9);assert.equal(state.token,'original-token');assert.equal(state.departure.first_at,now-45000);assert.equal(fixesRunning,true);
 assert.equal(native.uploads.some(x=>x.name==='cs_tracking'),false);
});
test('editing a place keeps the active arrival geometry until departure, then applies the new region',async()=>{
 await setup();native.networkFails=false;const edited={...place,lat:1,radius_m:200,activity_key:'gym'};
 native.rpcHandler=async(name,args)=>name==='cs_snapshot'?{places:[edited]}:{accepted:args.events?.map(e=>e.event_id)??[],created:[]};
 try{
  await tracking.startTracking();let state=await tracking.trackingState();assert.equal(state.candidate.workout_label,'Climbing');assert.equal(state.places[0].lat,0);assert.equal(regions[0].latitude,0);assert.equal(state.next_places[0].lat,1);
  await tracking.receiveFixes([loc(fix(now-45000)),loc(fix(now-10000))]);state=await tracking.trackingState();assert.equal(state.candidate,null);assert.equal(state.places[0].lat,1);assert.equal(regions[0].latitude,1);assert.equal(state.next_places,undefined);assert.equal(state.token,'original-token');
 }finally{native.rpcHandler=null;native.networkFails=true;}
});


test('a native exit cannot erase an active workout; drift and re-entry preserve its original timer',async()=>{
 await setup();
 const exit={event_id:'boundary-drift',place_id:place.id,kind:'EXIT',source:'geofence',observed_at:new Date(now-60000).toISOString()};
 await tracking.receiveEvent(exit);
 assert.equal((await tracking.trackingState()).candidate.visit_id,'arrival');
 assert.equal((await tracking.trackingState()).candidate.entered_at,candidate.entered_at);
 assert.ok((await tracking.trackingState()).boundary_exit_at);assert.equal(fixesRunning,true);
 assert.equal((await(await local.database()).getAllAsync('SELECT payload FROM cs_outbox')).length,0);
 await tracking.receiveFixes([loc(fix(now-45000,0)),loc(fix(now-10000,0))]);
 assert.ok((await tracking.trackingState()).candidate);
 await tracking.receiveEvent({...exit,event_id:'return-inside',kind:'ENTER',observed_at:new Date(now-5000).toISOString()});
 assert.equal((await tracking.trackingState()).candidate.entered_at,candidate.entered_at);
 assert.equal((await tracking.trackingState()).boundary_exit_at,null);
});

test('a real native exit saves only after outside confirmation, using the original capture and one durable exit',async()=>{
 await setup();
 await tracking.receiveEvent({event_id:'native-departure',place_id:place.id,kind:'EXIT',source:'geofence',observed_at:new Date(now-60000).toISOString()});
 await tracking.receiveFixes([loc(fix(now-45000)),loc(fix(now-10000))]);
 const state=await tracking.trackingState();assert.equal(state.candidate,null);assert.equal(state.boundary_exit_at,null);
 const rows=await(await local.database()).getAllAsync('SELECT token,payload FROM cs_outbox');assert.equal(rows.length,1);assert.equal(rows[0].token,'original-token');
 const event=JSON.parse(rows[0].payload);assert.equal(event.recovered,true);assert.equal(event.observed_at,new Date(now-45000).toISOString());
});

test('Stop remains available without location confirmation and a stale native exit cannot close a newer timer',async()=>{
 await setup();
 await tracking.receiveEvent({event_id:'stale-exit',place_id:place.id,kind:'EXIT',source:'geofence',observed_at:new Date(now-7200000).toISOString()});
 assert.equal((await tracking.trackingState()).boundary_exit_at,undefined);
 await tracking.receiveEvent({event_id:'pending-exit',place_id:place.id,kind:'EXIT',source:'geofence',observed_at:new Date(now-10000).toISOString()});
 assert.ok((await tracking.trackingState()).candidate);
 await tracking.controlWorkout('STOP','arrival');assert.equal((await tracking.trackingState()).candidate,null);assert.equal((await tracking.trackingState()).boundary_exit_at,null);
 const rows=await(await local.database()).getAllAsync('SELECT payload FROM cs_outbox');assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0].payload).kind,'STOP');
});
