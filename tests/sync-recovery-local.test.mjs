import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';
globalThis.__turfMocks['expo-notifications']={setNotificationHandler:()=>{}};
globalThis.__turfMocks['react-native'].AppState={currentState:'background'};
const local=await import('../src/db/local.ts');
const tracking=await import('../src/classstreak/tracking.ts');
const {captureHoldReason}=await import('../src/classstreak/syncRecovery.ts');
test('expired setup evidence stays intact while valid events sync; retries and other owners are isolated',async()=>{
 await local.bindOwner('recovery-owner');native.session={user:{id:'recovery-owner'},expires_at:Date.now()/1000+3600};native.networkFails=false;
 await local.write('cs:tracking',{owner:'recovery-owner',paused:false,token:'current',places:[],candidate:null});
 await tracking.syncVisits();const db=await local.database();
 const payload=id=>JSON.stringify({event_id:id,source:'geofence',kind:'EXIT',observed_at:new Date().toISOString()});
 for(const [id,owner,token] of [['old','recovery-owner','old-token'],['valid','recovery-owner','current'],['other','other-owner','other']])await db.runAsync('INSERT INTO cs_outbox(event_id,owner,token,payload) VALUES(?,?,?,?)',id,owner,token,payload(id));
 const original=(await db.getFirstAsync("SELECT payload FROM cs_outbox WHERE event_id='old'")).payload;
 native.rpcHandler=async(name,args)=>{
  if(name==='cs_capture_status')return {matches:false,active:true,server_time:new Date().toISOString()};
  if(args.capture_token!=='current')throw new Error('CAPTURE_EXPIRED');
  return {accepted:args.events.map(e=>e.event_id),created:[]};
 };
 await tracking.syncVisits();await tracking.syncVisits();
 const saved=await db.getAllAsync('SELECT event_id,token,payload FROM cs_outbox ORDER BY seq');assert.deepEqual(saved.map(x=>x.event_id),['old','other']);assert.equal(saved[0].payload,original);
 assert.equal(saved[0].token,'old-token');assert.equal((await db.getAllAsync('SELECT * FROM cs_outbox_holds')).length,1);
 await db.runAsync('INSERT INTO cs_outbox(event_id,owner,token,payload) VALUES(?,?,?,?)','network','recovery-owner','current',payload('network'));native.networkFails=true;await assert.rejects(tracking.syncVisits(),/offline/);assert.ok(await db.getFirstAsync("SELECT * FROM cs_outbox WHERE event_id='network'"));assert.equal((await db.getAllAsync('SELECT * FROM cs_outbox_holds')).length,1);native.networkFails=false;
});
test('future timestamps and simulated events are not permanently held',()=>{
 const now=Date.now(),s={matches:true,active:true,started_at:new Date(now-3600000).toISOString(),stopped_at:null,server_time:new Date(now).toISOString()};
 assert.equal(captureHoldReason({source:'geofence',observed_at:new Date(now+600000).toISOString()},s),null);
 assert.equal(captureHoldReason({source:'simulated',observed_at:new Date(now-86400000).toISOString()},{...s,matches:false}),null);
 assert.equal(captureHoldReason({source:'geofence',observed_at:new Date(now-7200000).toISOString()},s),'Before this tracking setup');
});
