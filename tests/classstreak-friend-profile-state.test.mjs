import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFriendProfileSession} from '../src/classstreak/friendProfileState.ts';

const profile={id:'friend',first_name:'Ifti',is_demo:false,weekly_count:2,weekly_goal:3,streak:1,worked_out_today:false,nudge_available:true,nudged_today:false,week_details:[]};
const snapshot={profile:{id:'owner'},friends:[]};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function create(request){const states=[],snapshots=[];const session=createFriendProfileSession({ownerId:'owner',peerId:'friend',request,onState:value=>states.push(value),onSnapshot:value=>snapshots.push(value)});return {session,states,snapshots,last:()=>states.at(-1)};}

test('A nudge reports success only after the real write, blocks rapid resends, then refreshes',async()=>{
 const write=deferred();let writes=0,reads=0;
 const fixture=create(async(name,args)=>{
  if(name==='cs_friend_profile'){assert.deepEqual(args,{peer:'friend'});return {...profile,nudged_today:++reads>1,nudge_available:reads===1};}
  assert.deepEqual(args,{action:'nudge',payload:{id:'friend'}});++writes;return write.promise;
 });
 await fixture.session.load();const pending=fixture.session.nudge();await fixture.session.nudge();
 assert.equal(writes,1);assert.equal(fixture.last().sending,true);assert.equal(fixture.last().sent,false);assert.equal(fixture.snapshots.length,0);
 write.resolve(snapshot);await pending;
 assert.equal(reads,2);assert.equal(fixture.last().sent,true);assert.equal(fixture.last().sending,false);assert.deepEqual(fixture.snapshots,[snapshot]);
 await fixture.session.nudge();assert.equal(writes,1);
});

test('Failed and ambiguous network writes never show success; a read checks if it reached the server',async()=>{
 let reads=0,writes=0;
 const fixture=create(async name=>{
  if(name==='cs_friend_profile')return {...profile,nudged_today:++reads>1,nudge_available:reads===1};
  ++writes;throw new Error('Network request failed');
 });
 await fixture.session.load();await fixture.session.nudge();
 assert.equal(fixture.last().sent,false);assert.equal(fixture.snapshots.length,0);assert.match(fixture.last().error.message,/Network/);assert.equal(fixture.last().profile.nudged_today,true);
 await fixture.session.nudge();assert.equal(writes,1);
});

test('Worked-out, already-nudged, unavailable and demo profiles cannot send',async()=>{
 for(const patch of [{worked_out_today:true},{nudged_today:true},{nudge_available:false},{is_demo:true}]){
  let writes=0;const fixture=create(async name=>{if(name==='cs_friend_profile')return {...profile,...patch};++writes;return snapshot;});
  await fixture.session.load();await fixture.session.nudge();assert.equal(writes,0);
 }
});

test('Closing or switching the account while a nudge is in flight cannot install its response',async()=>{
 const write=deferred();const fixture=create(async name=>name==='cs_friend_profile'?profile:write.promise);
 await fixture.session.load();const pending=fixture.session.nudge();fixture.session.dispose();const count=fixture.states.length;
 write.resolve(snapshot);await pending;
 assert.equal(fixture.states.length,count);assert.equal(fixture.snapshots.length,0);
});

test('A response owned by a different account never updates the parent or shows success',async()=>{
 const fixture=create(async name=>name==='cs_friend_profile'?profile:{profile:{id:'someone-else'}});
 await fixture.session.load();await fixture.session.nudge();
 assert.equal(fixture.last().sent,false);assert.equal(fixture.last().error.message,'AUTH_REQUIRED');assert.equal(fixture.snapshots.length,0);
});

test('Old or closed-screen profile reads cannot overwrite a newer read',async()=>{
 const first=deferred(),second=deferred();let reads=0;
 const fixture=create(async()=>++reads===1?first.promise:second.promise);
 const old=fixture.session.load(),fresh=fixture.session.load();
 second.resolve({...profile,weekly_count:3});await fresh;
 first.resolve({...profile,weekly_count:1});await old;
 assert.equal(fixture.last().profile.weekly_count,3);
 const closed=deferred();const other=create(()=>closed.promise);const loading=other.session.load();other.session.dispose();const count=other.states.length;closed.resolve(profile);await loading;assert.equal(other.states.length,count);
});

test('A denied or mismatched profile clears stale details',async()=>{
 let reads=0;const fixture=create(async()=>++reads===1?profile:{...profile,id:'other-person'});
 await fixture.session.load();await fixture.session.load();assert.equal(fixture.last().profile,null);assert.equal(fixture.last().error.message,'FORBIDDEN');
});
