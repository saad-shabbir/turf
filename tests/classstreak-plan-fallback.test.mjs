import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';

const setup=async(db,auth,name,tz='UTC')=>{await actor(db,auth);return {...await rpc(db,'cs_bootstrap',[{first_name:name,selected:['gym'],goals:{gym:2},tz,days:[]}]),auth};};
const befriend=async(db,a,b)=>{await actor(db,b.auth);await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);};
const planned=week=>week.filter(d=>d.planned.length).map(d=>[d.weekday,d.planned.map(p=>[p.activity_key,p.period,p.time])]);

test('a friend who never synced a plan shows their usual days for last, this and next week',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Ifti','Asia/Karachi'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  await actor(db,A);await rpc(db,'cs_settings',['days',{schedules:[{activity_key:'gym',days:[0,2,4],time:'evening'}]}]);
  await actor(db,B);const plan=await rpc(db,'cs_profile_plan',[a.profile.id]);
  const expected=[[0,[['gym','evening',null]]],[2,[['gym','evening',null]]],[4,[['gym','evening',null]]]];
  assert.deepEqual(planned(plan.this_week),expected);assert.deepEqual(planned(plan.next_week),expected);assert.deepEqual(planned(plan.last_week.days),expected);
  assert.equal(plan.last_week.planned_days,3);assert.equal(plan.last_week.completed_days,0);
  // Days follow the friend's own time zone.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  assert.equal(plan.today,today);assert.ok(plan.this_week.some(d=>d.day===today));
 }finally{await db.close();}
});

test('the older usual_days list is used when there are no activity schedules',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Maaz'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  await db.exec('reset role');await db.query("insert into classstreak.usual_days values($1,1,'morning'),($1,5,'midday')",[a.profile.id]);
  await actor(db,B);const plan=await rpc(db,'cs_profile_plan',[a.profile.id]);
  assert.deepEqual(planned(plan.this_week),[[1,[['gym','morning',null]]],[5,[['gym','midday',null]]]]);
 }finally{await db.close();}
});

test('once a friend has synced, their real plan replaces their usual days',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Aayan'),b=await setup(db,B,'Bob');await befriend(db,a,b);
  await actor(db,A);await rpc(db,'cs_settings',['days',{schedules:[{activity_key:'gym',days:[0,1,2,3,4,5,6],time:'morning'}]}]);
  const monday=(await rpc(db,'cs_profile_plan',[null])).this_week[0].day;
  const day=n=>new Date(Date.parse(monday+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  await rpc(db,'cs_plan_sync',[[{day:day(10),slot:'gym:3',activity_key:'gym',time:'18:30',period:'evening'}]]);
  await actor(db,B);const plan=await rpc(db,'cs_profile_plan',[a.profile.id]);
  assert.deepEqual(planned(plan.this_week),[]);assert.deepEqual(planned(plan.last_week.days),[]);
  assert.deepEqual(planned(plan.next_week),[[3,[['gym','evening','18:30']]]]);
 }finally{await db.close();}
});

test('message pushes show the sender and the message, trimmed to 140 characters',async()=>{
 const db=await fresh();try{
  const a=await setup(db,A,'Alice'),b=await setup(db,B,'Bob',['UTC','Europe/London','America/New_York','America/Los_Angeles','Pacific/Honolulu','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'].find(z=>{const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:z,hour:'numeric',hourCycle:'h23'}).format(new Date()));return h>=9&&h<=20;}));
  await befriend(db,a,b);await actor(db,B);await rpc(db,'cs_push_token',['ExponentPushToken[abcdefghijklmnopqrstuv]',true]);
  await actor(db,A);const long='x'.repeat(200);
  await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'Gym at 6?',client_id:crypto.randomUUID()}]);
  await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:long,client_id:crypto.randomUUID()}]);
  await db.exec('reset role');const rows=(await db.query("select title,body,data from classstreak.push_outbox where kind='dm' order by id")).rows;
  assert.deepEqual(rows.map(r=>[r.title,r.body]),[['Alice','Gym at 6?'],['Alice','x'.repeat(139)+'…']]);assert.equal(rows[0].data.pane,`dm:${a.profile.id}`);
  // Muted senders still send nothing to the lock screen.
  await actor(db,B);await rpc(db,'cs_social',['mute',{id:a.profile.id}]);
  await actor(db,A);await rpc(db,'cs_messages',['send',{peer:b.profile.id,body:'Muted',client_id:crypto.randomUUID()}]);
  await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from classstreak.push_outbox where kind='dm'")).rows[0].n,2);
 }finally{await db.close();}
});
