import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlanning,plannedReminders,planningFromSnapshot,removePlannedWorkout,restorePlannedWorkout,savePlannedWorkout,schedulesToRules,weekCalendar,workoutsOn} from '../src/classstreak/planning.ts';
import {reconcilePlannedNotifications,reminderFingerprint} from '../src/classstreak/planningNotificationSync.ts';

const snapshot={profile:{id:'owner-a',tz:'America/Los_Angeles',notification_preferences:{}},usual_days:[{activity_key:'gym',weekday:2,time_of_day:'evening'}],goals:[{activity_key:'gym',goal:3}],sessions:[]};
const plan={...emptyPlanning(),rules:schedulesToRules([{activity_key:'gym',days:[2],time:'evening',exact_time:'19:00'}])};
const original=()=>workoutsOn(plan,'2026-09-30')[0];

test('A weekly time appears across weeks and the calendar rolls over month/year boundaries',()=>{
 assert.equal(workoutsOn(plan,'2026-10-07')[0].time,'19:00');
 assert.deepEqual(weekCalendar('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.equal(workoutsOn(plan,'2026-10-01').length,0);
});
test('One-day boxing replaces weights without duplicating it or changing next week',()=>{
 const changed=savePlannedWorkout(plan,{...original(),activity_key:'boxing',time:'18:15',focus:''},false);
 assert.equal(workoutsOn(changed,'2026-09-30').length,1);
 assert.equal(workoutsOn(changed,'2026-09-30')[0].activity_key,'boxing');
 assert.equal(workoutsOn(changed,'2026-10-07')[0].activity_key,'gym');
 assert.equal(workoutsOn(changed,'2026-10-07')[0].time,'19:00');
 assert.equal(workoutsOn(restorePlannedWorkout(changed,'2026-09-30','gym:2'),'2026-09-30')[0].activity_key,'gym');
});
test('Changing the weekly workout keeps the slot stable and removes only that day override',()=>{
 let changed=savePlannedWorkout(plan,{...original(),time:'18:00'},false);
 changed=savePlannedWorkout(changed,{...original(),activity_key:'boxing',time:'20:00'},true);
 assert.equal(changed.rules.length,1);assert.equal(changed.overrides.length,0);
 assert.equal(workoutsOn(changed,'2026-10-07')[0].activity_key,'boxing');
});
test('Skipping one day is reversible and removing a recurring plan cancels its future dates',()=>{
 const skipped=removePlannedWorkout(plan,original(),false);
 assert.equal(workoutsOn(skipped,'2026-09-30').length,0);
 assert.equal(workoutsOn(skipped,'2026-10-07').length,1);
 assert.equal(workoutsOn(restorePlannedWorkout(skipped,'2026-09-30','gym:2'),'2026-09-30').length,1);
 assert.equal(workoutsOn(removePlannedWorkout(skipped,original(),true),'2026-10-07').length,0);
});
test('A one-off on a rest day does not silently repeat',()=>{
 const once=savePlannedWorkout(plan,{...original(),id:'extra:once',day:'2026-10-01',activity_key:'yoga'},false);
 assert.equal(workoutsOn(once,'2026-10-01').length,1);assert.equal(workoutsOn(once,'2026-10-08').length,0);
 assert.equal(workoutsOn(removePlannedWorkout(once,workoutsOn(once,'2026-10-01')[0],false),'2026-10-01').length,0);
});
test('One-hour reminders use the owner timezone rather than the device timezone',()=>{
 const reminders=plannedReminders(plan,snapshot,new Date('2026-09-30T08:00:00Z'));
 assert.equal(reminders[0].at.toISOString(),'2026-10-01T01:00:00.000Z');
 assert.match(reminders[0].id,/^plan:owner-a:2026-09-30:/);
 const tokyo=plannedReminders(plan,{...snapshot,profile:{...snapshot.profile,tz:'Asia/Tokyo'}},new Date('2026-09-30T00:00:00Z'));
 assert.equal(tokyo[0].at.toISOString(),'2026-09-30T09:00:00.000Z');
});
test('Reminder occurrences track DST rather than drifting an hour after clocks change',()=>{
 const sunday={...plan,rules:schedulesToRules([{activity_key:'gym',days:[6],time:'morning',exact_time:'09:00'}])};
 const reminders=plannedReminders(sunday,snapshot,new Date('2026-10-24T00:00:00Z'));
 assert.equal(reminders.find(r=>r.id.includes('2026-10-25')).at.toISOString(),'2026-10-25T15:00:00.000Z');
 assert.equal(reminders.find(r=>r.id.includes('2026-11-01')).at.toISOString(),'2026-11-01T16:00:00.000Z');
});
test('A midnight workout can remind on the preceding date, and nonexistent DST times are skipped',()=>{
 const midnight={...plan,rules:schedulesToRules([{activity_key:'gym',days:[2],time:'evening',exact_time:'00:30'}])};
 assert.equal(plannedReminders(midnight,snapshot,new Date('2026-09-29T18:00:00Z'))[0].at.toISOString(),'2026-09-30T06:30:00.000Z');
 const spring={...plan,rules:schedulesToRules([{activity_key:'gym',days:[6],time:'morning',exact_time:'02:30'}])};
 assert.ok(!plannedReminders(spring,snapshot,new Date('2026-03-07T12:00:00Z')).some(r=>r.id.includes('2026-03-08')));
});
test('Explicit reminder preferences, completed workouts and skipped days remove pending reminders',()=>{
 const now=new Date('2026-09-30T08:00:00Z');
 assert.equal(plannedReminders(plan,{...snapshot,profile:{...snapshot.profile,notification_preferences:{usual:false}}},now).length,0);
 assert.equal(plannedReminders({...plan,rules:plan.rules.map(r=>({...r,reminder:false}))},snapshot,now).length,0);
 const logged={...snapshot,sessions:[{day_key:'2026-09-30',activity_key:'gym',source:'geofence'}]};
 assert.ok(!plannedReminders(plan,logged,now).some(r=>r.id.includes('2026-09-30')));
 assert.ok(plannedReminders(plan,{...logged,sessions:[{...logged.sessions[0],source:'seed'}]},now).some(r=>r.id.includes('2026-09-30')));
 assert.ok(!plannedReminders(removePlannedWorkout(plan,original(),false),snapshot,now).some(r=>r.id.includes('2026-09-30')));
});
test('Same-day activities retain separate reminders and custom climbing remains supported',()=>{
 const multi={...plan,rules:[...plan.rules,...schedulesToRules([{activity_key:'custom:Climbing',days:[2,2],time:'morning',exact_time:'09:30'}])]};
 const reminders=plannedReminders(multi,snapshot,new Date('2026-09-30T07:00:00Z')).filter(r=>r.id.includes('2026-09-30'));
 assert.equal(reminders.length,2);assert.match(reminders[0].title,/climbing/);assert.equal(new Set(reminders.map(r=>r.id)).size,2);
 assert.equal(planningFromSnapshot(snapshot).rules[0].period,'evening');
});

function fakeTransport(initial=[]){const items=new Map(initial.map(x=>[x.identifier,x]));const calls=[];return {items,calls,transport:{list:async()=>[...items.values()],cancel:async id=>{calls.push(['cancel',id]);items.delete(id);},schedule:async (r,fingerprint)=>{calls.push(['schedule',r.id]);items.set(r.id,{identifier:r.id,content:{data:{planning_fingerprint:fingerprint}}});}}};}
test('OS reconciliation cancels old reminder times, adds replacements and preserves arrival alerts',async()=>{
 const reminder=plannedReminders(plan,snapshot,new Date('2026-09-30T08:00:00Z'))[0];
 const fake=fakeTransport([{identifier:reminder.id,content:{data:{planning_fingerprint:'old'}}},{identifier:'usual:2026-09-30'},{identifier:'arrival:abc'}]);
 await reconcilePlannedNotifications([reminder],fake.transport);
 assert.deepEqual(fake.calls,[['cancel',reminder.id],['cancel','usual:2026-09-30'],['schedule',reminder.id]]);
 assert.ok(fake.items.has('arrival:abc'));
 fake.calls.length=0;await reconcilePlannedNotifications([reminder],fake.transport);assert.equal(fake.calls.length,0);
 await reconcilePlannedNotifications([],fake.transport);assert.ok(!fake.items.has(reminder.id));assert.ok(fake.items.has('arrival:abc'));
});
test('Missing OS schedules recover even if a previous fingerprint was saved',async()=>{
 const reminder=plannedReminders(plan,snapshot,new Date('2026-09-30T08:00:00Z'))[0];const fake=fakeTransport();
 await reconcilePlannedNotifications([reminder],fake.transport);
 assert.equal(fake.items.get(reminder.id).content.data.planning_fingerprint,reminderFingerprint(reminder));
 fake.items.clear();await reconcilePlannedNotifications([reminder],fake.transport);assert.equal(fake.calls.filter(c=>c[0]==='schedule').length,2);
});
