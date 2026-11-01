import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B,C} from './database-harness.mjs';

const hour=tz=>Number(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'}).format(new Date()));
const zones=['UTC','Europe/London','America/New_York','America/Los_Angeles','Pacific/Honolulu','Asia/Tokyo','Asia/Kolkata','Australia/Sydney','Pacific/Kiritimati'];
// Daytime somewhere, so pushes are not held for quiet hours; night somewhere else.
const daytime=()=>zones.find(z=>hour(z)>=9&&hour(z)<=20);
const night=()=>zones.find(z=>hour(z)>=23||hour(z)<6);
const localTime=(tz,at)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
const token=n=>`ExponentPushToken[${String(n).padEnd(22,'x')}]`;
const setup=async(db,auth,name,tz=daytime())=>{await actor(db,auth);return rpc(db,'cs_bootstrap',[{first_name:name,selected:['gym'],goals:{gym:2},tz,days:[]}]);};
const announce=async(db,runtime,body='Faster check-ins. Tap to update.')=>{await db.exec('reset role');return (await db.query('select classstreak.announce_update($1,$2,$3) n',[runtime,'ClassStreak update',body])).rows[0].n;};
const queued=async db=>{await db.exec('reset role');return (await db.query("select o.token,o.title,o.body,o.data,o.send_after,u.first_name from classstreak.push_outbox o join classstreak.users u on u.id=o.user_id where o.kind='app_update' and o.sent_at is null order by o.token")).rows;};

// Alice has two phones on different runtimes, Bob one on R1, and Cara an
// older app that registered without a runtime.
async function phones(db){
 const a=await setup(db,A,'Alice');await rpc(db,'cs_push_token',[token(1),true,'R1']);await rpc(db,'cs_push_token',[token(2),true,'R2']);
 const b=await setup(db,B,'Bob');await rpc(db,'cs_push_token',[token(3),true,'R1']);
 const c=await setup(db,C,'Cara');await rpc(db,'cs_push_token',[token(4),true]);
 return {a,b,c};
}

test('an update announcement queues one push per phone on that runtime, with no inbox item',async()=>{
 const db=await fresh();try{
  await phones(db);
  assert.equal(await announce(db,'R1'),2);
  let rows=await queued(db);
  assert.deepEqual(rows.map(r=>[r.first_name,r.token]),[['Alice',token(1)],['Bob',token(3)]]);
  assert.deepEqual(rows[0].data,{type:'app_update',kind:'app_update'});assert.equal(rows[0].title,'ClassStreak update');assert.equal(rows[0].body,'Faster check-ins. Tap to update.');
  // Each push goes to its own phone only, never to Alice's phone on R2.
  const claimed=await rpc(db,'cs_push_claim',[10]);
  assert.deepEqual(claimed.map(c=>c.tokens).sort(),[[token(1)],[token(3)]]);
  assert.equal((await db.query('select count(*)::int n from classstreak.inbox')).rows[0].n,0);
  // Every phone when no runtime is given; a repeat replaces pushes not yet sent.
  await db.query('delete from classstreak.push_outbox');
  assert.equal(await announce(db,'R1','First.'),2);
  assert.equal(await announce(db,null,'Second.'),4);
  rows=await queued(db);
  assert.deepEqual(rows.map(r=>r.token),[token(1),token(2),token(3),token(4)]);
  assert.ok(rows.every(r=>r.body==='Second.'));
  // An unknown runtime reaches nobody, and a blank message is refused.
  assert.equal(await announce(db,'R9'),0);
  await assert.rejects(announce(db,'R1','  '),/TITLE_AND_BODY_REQUIRED/);
 }finally{await db.close();}
});

test('the App updates switch, demo accounts and quiet hours are respected',async()=>{
 const zone=night();
 const db=await fresh();try{
  const {b,c}=await phones(db);
  await actor(db,B);await rpc(db,'cs_settings',['profile',{notification_preferences:{app_update:false}}]);
  assert.equal(await announce(db,'R1'),1);
  assert.deepEqual((await queued(db)).map(r=>r.first_name),['Alice']);
  await db.query('update classstreak.users set is_demo=true,auth_id=null,demo_owner=$2 where id=$1',[c.profile.id,b.profile.id]);
  assert.equal(await announce(db,null),2);
  assert.deepEqual((await queued(db)).map(r=>r.token),[token(1),token(2)]);
  if(zone){
   // At night the push waits until 7:00 local time instead of being dropped.
   await db.query("update classstreak.users set tz=$1,notification_preferences=notification_preferences||'{\"app_update\":true}' where id=$2",[zone,b.profile.id]);
   await announce(db,'R1');
   const bob=(await queued(db)).find(r=>r.first_name==='Bob');
   assert.ok(bob.send_after>new Date());assert.equal(localTime(zone,bob.send_after),'07:00');
   assert.ok(!(await rpc(db,'cs_push_claim',[10])).some(c=>c.tokens.includes(token(3))));
  }
 }finally{await db.close();}
});

test('only the server can announce an update',async()=>{
 const db=await fresh();try{
  await phones(db);
  for(const who of [A,null]){
   await actor(db,who);
   await assert.rejects(db.query("select classstreak.announce_update('R1','ClassStreak update','Tap to update.')"),/permission denied/);
  }
  await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from classstreak.push_outbox")).rows[0].n,0);
 }finally{await db.close();}
});

test('phones register their runtime; older apps still register and keep it',async()=>{
 const db=await fresh();try{
  await setup(db,A,'Alice');
  await rpc(db,'cs_push_token',[token(5),true,'7a5bdc82abc50e41ab72d3eb819bf4f042c65633']);
  await rpc(db,'cs_push_token',[token(5),true]);
  await assert.rejects(rpc(db,'cs_push_token',[token(6),true,'not a runtime!']),/INVALID_RUNTIME/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select token,runtime_version from classstreak.push_tokens')).rows,[{token:token(5),runtime_version:'7a5bdc82abc50e41ab72d3eb819bf4f042c65633'}]);
  await actor(db,A);await rpc(db,'cs_push_token',[token(5),true,'2.0.0']);await rpc(db,'cs_push_token',[token(5),false]);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from classstreak.push_tokens')).rows[0].n,0);
 }finally{await db.close();}
});

test('other pushes still reach every phone of the person',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice');await rpc(db,'cs_push_token',[token(1),true,'R1']);await rpc(db,'cs_push_token',[token(2),true,'R2']);
  const b=await setup(db,B,'Bob');await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);
  await rpc(db,'cs_messages',['send',{peer:a.profile.id,body:'Gym at 6?',client_id:crypto.randomUUID()}]);
  await db.exec('reset role');const claimed=await rpc(db,'cs_push_claim',[10]);
  assert.equal(claimed.length,1);assert.deepEqual([...claimed[0].tokens].sort(),[token(1),token(2)]);
  assert.equal(b.profile.first_name,'Bob');
 }finally{await db.close();}
});
