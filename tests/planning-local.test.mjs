import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';

const scheduled=new Map();let granted=true;let gate=null;let began=null;
globalThis.__turfMocks['react-native'].AppState={currentState:'active'};
globalThis.__turfMocks['expo-notifications']={
 setNotificationHandler:()=>{},
 getPermissionsAsync:async()=>({granted}),requestPermissionsAsync:async()=>({granted}),
 setBadgeCountAsync:async()=>{},
 SchedulableTriggerInputTypes:{DATE:'date',TIME_INTERVAL:'timeInterval'},
 getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],
 cancelScheduledNotificationAsync:async id=>{scheduled.delete(id);},
 cancelAllScheduledNotificationsAsync:async()=>{scheduled.clear();},
 scheduleNotificationAsync:async request=>{if(gate){began?.();await gate;}scheduled.set(request.identifier,request);return request.identifier;},
};
const local=await import('../src/db/local.ts');
const store=await import('../src/classstreak/planningStore.ts');
const planning=await import('../src/classstreak/planning.ts');
const notifications=await import('../src/classstreak/notifications.ts');
const {dayKey,mondayKey}=await import('../src/classstreak/engine.ts');
const snapshot=owner=>({profile:{id:owner,first_name:'Test',tz:'America/Los_Angeles',notification_preferences:{recap:false,risk:false}},usual_days:[],goals:[{activity_key:'gym',goal:3}],pending_goals:[],sessions:[],friends:[],inbox:[],weeks:[],feed:[],server_time:new Date().toISOString()});
const schedules=[{activity_key:'gym',days:[0,1,2,3,4,5,6],time:'evening',exact_time:'19:15',reminder_enabled:true}];

test('Exact times and one-off activity overrides survive storage reload; owners and purge stay isolated',async()=>{
 await local.bindOwner('owner-a');const s=snapshot('owner-a');await local.write('cs:snapshot',{auth:s.profile.id,value:s});
 await store.seedWeeklyPlanning(s.profile.id,schedules);let saved=await store.loadWeeklyPlanning(s);
 assert.equal(saved.rules.length,7);assert.equal(saved.rules[2].time,'19:15');
 const workout=planning.workoutsOn(saved,'2026-09-30')[0];saved=planning.savePlannedWorkout(saved,{...workout,activity_key:'boxing',time:'18:00'},false);
 await store.saveWeeklyPlanning(s.profile.id,saved);saved=await store.loadWeeklyPlanning(s);
 assert.equal(planning.workoutsOn(saved,'2026-09-30')[0].activity_key,'boxing');
 assert.equal(planning.workoutsOn(saved,'2026-10-07')[0].activity_key,'gym');
 assert.equal((await store.savedPlanningSchedules(s))[0].exact_time,'19:15');
 await store.seedWeeklyPlanning(s.profile.id,[]);assert.equal((await store.loadWeeklyPlanning(s)).rules.length,7);
 await store.replaceWeeklySchedules(s.profile.id,[{...schedules[0],exact_time:'20:00'}]);
 assert.equal(planning.workoutsOn(await store.loadWeeklyPlanning(s),'2026-09-30')[0].time,'18:00');
 let rest=await store.loadWeeklyPlanning(s);const tomorrowWorkout=planning.workoutsOn(rest,'2026-10-01')[0];rest=planning.removePlannedWorkout(rest,tomorrowWorkout,false);rest=planning.setRestDayChoice(rest,'2026-10-01','yes');await store.saveWeeklyPlanning(s.profile.id,rest);
 assert.equal(planning.restDayPrompt(await store.loadWeeklyPlanning(s),'2026-10-01','2026-10-01',false),'rest','rest answer survives a fresh storage read');
 const other=await store.loadWeeklyPlanning(snapshot('owner-b'));assert.equal(other.rules.length,0);assert.equal(planning.restDayPrompt(other,'2026-10-01','2026-10-01',false),'question','another owner does not inherit the rest answer');
});

test('Permission denial schedules nothing; logout cancels in-flight work and an old owner cannot schedule for a new account',async()=>{
 const a=snapshot('owner-a');granted=false;await notifications.scheduleReminders(a);assert.equal(scheduled.size,0);granted=true;
 let release;gate=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{began=resolve;});
 const work=notifications.scheduleReminders(a);await started;
 const cleared=notifications.clearNotifications();release();await Promise.all([work,cleared]);gate=null;began=null;
 assert.equal(scheduled.size,0);
 await notifications.scheduleReminders(a);assert.equal(scheduled.size,0);
 await local.purge();assert.equal(await local.read('cs:weekly_planning:owner-a',null),null);
 await local.write('auth_blocked',false);await local.bindOwner('owner-b');const b=snapshot('owner-b');await local.write('cs:snapshot',{auth:b.profile.id,value:b});await store.seedWeeklyPlanning(b.profile.id,schedules);
 await notifications.scheduleReminders(a);assert.equal(scheduled.size,0);
 await notifications.scheduleReminders(b);assert.ok(scheduled.size>0);assert.ok([...scheduled.keys()].every(id=>id.startsWith('plan:owner-b:')));
});

test('Clearing notifications does not require readable storage during key-mismatch recovery',async()=>{
 native.failStorage=true;
 // Make the already-open database fail reads, as a recovery boot would.
 const db=await local.database();const getFirst=db.getFirstAsync;db.getFirstAsync=async()=>{throw new Error('STORAGE_ERROR:READ:KEY_MISMATCH');};
 try{await notifications.clearNotifications();assert.equal(scheduled.size,0);}finally{db.getFirstAsync=getFirst;native.failStorage=false;}
});

test('A saved-workout notification reports genuine progress even when the RPC still contains old demo history',async()=>{
 const now=new Date();const s=snapshot('owner-b');s.profile.notification_preferences.usual=false;
 const workout={id:'real-notification',user_id:'owner-b',activity_key:'gym',workout_label:'Weights',duration_sec:3600,started_at:new Date(now.getTime()-3600000).toISOString(),day_key:dayKey(now,s.profile.tz),week_key:mondayKey(now,s.profile.tz),source:'geofence',counted:false};
 s.sessions=[{...workout,id:'seed-notification',source:'seed',started_at:new Date(now.getTime()-7200000).toISOString(),counted:true},workout];
 native.session={user:{id:'owner-b'},expires_at:Date.now()/1000+3600};native.rpcHandler=async()=>s;
 globalThis.__turfMocks['react-native'].AppState.currentState='background';
 try{await notifications.notifySession([workout.id]);assert.match(scheduled.get('session:'+workout.id).content.body,/1\/3 this week/);}finally{globalThis.__turfMocks['react-native'].AppState.currentState='active';native.rpcHandler=null;}
});
