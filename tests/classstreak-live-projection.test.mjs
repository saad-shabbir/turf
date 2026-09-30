import {test} from 'node:test';
import assert from 'node:assert/strict';
import {liveSnapshot} from '../src/classstreak/liveSnapshot.ts';
import {progress} from '../src/classstreak/engine.ts';

const session=(id,source='geofence',patch={})=>({id,user_id:'me',place_id:'gym',activity_key:'gym',workout_label:'Weights',started_at:'2026-09-30T19:00:00Z',ended_at:'2026-09-30T20:00:00Z',duration_sec:3600,source,counted:true,verified:false,estimated:false,week_key:'2026-09-28',day_key:'2026-09-30',...patch});
const snapshot=sessions=>({profile:{id:'me',first_name:'Saad',tz:'America/Los_Angeles'},sessions,goals:[{activity_key:'gym',goal:3}],weeks:[],friends:[],feed:[],achievements:[],server_time:'2026-10-01T03:00:00Z'});

test('Legacy seed and simulated deduplication flags cannot hide a genuine qualifying visit',()=>{
 const original=snapshot([session('seed','seed',{started_at:'2026-09-30T09:00:00Z'}),session('sim','simulated',{started_at:'2026-09-30T10:00:00Z'}),session('real','geofence',{counted:false})]);
 const before=JSON.stringify(original);const live=liveSnapshot(original);
 assert.deepEqual(live.sessions.map(s=>[s.id,s.counted]),[['real',true]]);
 assert.equal(progress(live.sessions,live.weeks,live.goals,live.profile.tz,new Date(live.server_time)).count,1);
 assert.equal(JSON.stringify(original),before,'projection must not mutate the saved snapshot');
 assert.deepEqual(liveSnapshot(live),live,'app applies the projection in refresh and state setter');
});
test('Short stops stay visible but do not count or consume a later qualifying session',()=>{
 const live=liveSnapshot(snapshot([session('later','geofence',{started_at:'2026-09-30T21:00:00Z',counted:false}),session('short','geofence',{duration_sec:60}),session('removed','manual',{started_at:'2026-09-30T08:00:00Z',removed_at:'2026-09-30T09:00:00Z'})]));
 assert.deepEqual(live.sessions.map(s=>[s.id,s.counted]),[['later',true],['short',false],['removed',false]]);
 assert.deepEqual(live.achievements.map(a=>[a.id,a.count]),[['later',1]]);
});
test('Real day/activity counts are stable, activity-specific, manual-aware and bounded by server time',()=>{
 const live=liveSnapshot(snapshot([session('b'),session('a'),session('climb','geofence',{activity_key:'custom:Climbing',duration_sec:1500}),session('pilates','geofence',{activity_key:'reformer',duration_sec:1800}),session('manual','manual',{activity_key:'yoga',duration_sec:300}),session('future','manual',{activity_key:'boxing',started_at:'2026-10-03T10:00:00Z'})]));
 const flags=Object.fromEntries(live.sessions.map(s=>[s.id,s.counted]));
 assert.deepEqual(flags,{b:false,a:true,climb:true,pilates:false,manual:true,future:false});
});
test('Rebuild own milestones instead of displaying a server milestone inflated by sample history',()=>{
 const sessions=Array.from({length:9},(_,i)=>session(`seed-${i}`,'seed',{day_key:`2026-09-${String(i+1).padStart(2,'0')}`,started_at:`2026-09-${String(i+1).padStart(2,'0')}T09:00:00Z`}));
 const s={...snapshot([...sessions,session('real')]),achievements:[{id:'real',user_id:'me',first_name:'Saad',count:10,source:'geofence'},{id:'friend-real',user_id:'real-friend',first_name:'Ifti',count:1,source:'geofence'}]};
 const live=liveSnapshot(s);assert.deepEqual(live.achievements.find(a=>a.user_id==='me'),{id:'real',user_id:'me',first_name:'Saad',count:1,source:'geofence'});
 assert.equal(live.achievements.find(a=>a.user_id==='real-friend').count,1);
});
test('Default feed excludes fictional actors and synthetic posts, preserving genuine friends and posts',()=>{
 const s={...snapshot([]),friends:[{id:'fake',is_demo:true},{id:'friend',is_demo:false}],feed:[{id:'demo-seed',user_id:'fake',source:'seed'},{id:'demo-other',user_id:'fake',source:'manual'},{id:'simulation',user_id:'friend',source:'simulated'},{id:'real',user_id:'friend',source:'geofence'}],achievements:[{id:'fake-award',user_id:'fake',source:'manual'},{id:'simulation',user_id:'friend',source:'simulated'}]};
 const live=liveSnapshot(s);assert.deepEqual(live.friends.map(f=>f.id),['friend']);assert.deepEqual(live.feed.map(f=>f.id),['real']);assert.equal(live.achievements.length,0);
});
