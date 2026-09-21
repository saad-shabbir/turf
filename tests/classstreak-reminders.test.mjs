import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reminderPlan,localTime,quietUntil} from '../src/classstreak/reminder-plan.ts';
const snapshot={profile:{tz:'America/Los_Angeles',notification_preferences:{}},usual_days:[{weekday:1,time_of_day:'evening'}],goals:[{goal:3}],weeks:[],sessions:[],friends:[]};
test('Reminder dates respect local time, DST, preferences, and logged-day cancellation',()=>{
 const now=new Date('2026-09-22T15:00:00Z');const plan=reminderPlan(snapshot,now);const usual=plan.find(x=>x.id==='usual:2026-09-22');assert.equal(usual.at.toISOString(),'2026-09-23T00:00:00.000Z');assert.equal(new Set(plan.map(x=>x.id)).size,plan.length);
 const withFriend=reminderPlan({...snapshot,friends:[{status:'accepted',first_name:'Priya',days:[1]}]},now);assert.match(withFriend.find(x=>x.id==='usual:2026-09-22').body,/Priya already went/);assert.ok(!withFriend.find(x=>x.id==='usual:2026-09-29').body.includes('Priya'));
 const logged={...snapshot,sessions:[{day_key:'2026-09-22',week_key:'2026-09-21',counted:true}]};assert.ok(!reminderPlan(logged,now).some(x=>x.id==='usual:2026-09-22'));
 assert.ok(!reminderPlan({...snapshot,profile:{...snapshot.profile,notification_preferences:{usual:false,recap:false,risk:false}}},now).length);
 assert.equal(localTime('2026-11-01',8,0,snapshot.profile.tz).toISOString(),'2026-11-01T16:00:00.000Z');
 assert.equal(quietUntil(new Date('2026-09-23T05:30:00Z'),snapshot.profile.tz).toISOString(),'2026-09-23T14:00:00.000Z');assert.equal(quietUntil(now,snapshot.profile.tz),null);
});
