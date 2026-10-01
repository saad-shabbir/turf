import test from 'node:test';
import assert from 'node:assert/strict';
import './native-harness.mjs';
const {setupProgress,loadSetupDismissed,dismissSetup}=await import('../src/classstreak/homeSetup.ts');

test('Checklist dismissal survives a fresh read and does not dismiss another account',async()=>{
 assert.equal(await loadSetupDismissed('setup-test-a'),false);
 await dismissSetup('setup-test-a');
 assert.equal(await loadSetupDismissed('setup-test-a'),true);
 assert.equal(await loadSetupDismissed('setup-test-b'),false);
});

test('Example friends and workouts cannot complete real setup steps',()=>{
 const s={places:[{enabled:false}],friends:[{status:'accepted',is_demo:true},{status:'pending',is_demo:false}],sessions:[{source:'seed'},{source:'simulated'},{source:'geofence',removed_at:'2026-09-30'}]};
 assert.deepEqual(setupProgress(s),{friends:0,place:false,workout:false,done:0});
 s.places.push({enabled:true});s.friends.push({status:'accepted',is_demo:false});s.sessions.push({source:'manual'});
 assert.deepEqual(setupProgress(s),{friends:1,place:true,workout:true,done:2});
 s.friends.push(...Array.from({length:4},()=>({status:'accepted',is_demo:false})));
 assert.deepEqual(setupProgress(s),{friends:3,place:true,workout:true,done:3});
});
