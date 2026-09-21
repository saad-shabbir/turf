import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Custom activity, two places and distinct schedules persist atomically; goals remain deferred',async()=>{
 const db=await fresh();try{
  await actor(db,A);
  const s=await rpc(db,'cs_bootstrap',[{first_name:'Tester',selected:['yoga','custom:Climbing'],goals:{yoga:1,'custom:Climbing':2},schedules:[{activity_key:'yoga',days:[0],time:'morning'},{activity_key:'custom:Climbing',days:[2,4],time:'evening'}],places:[{name:'Yoga room',activity_key:'yoga',lat:0,lng:0,radius_m:100},{name:'Climbing wall',activity_key:'custom:Climbing',lat:1,lng:1,radius_m:100}]}]);
  assert.equal(s.profile.theme,'clay');assert.equal(s.places.length,2);
  assert.deepEqual(s.usual_days.map(d=>[d.activity_key,d.weekday,d.time_of_day]),[['yoga',0,'morning'],['custom:Climbing',2,'evening'],['custom:Climbing',4,'evening']]);
  const changed=await rpc(db,'cs_settings',['goals',{goals:[{activity_key:'yoga',goal:1},{activity_key:'custom:Climbing',goal:4}]}]);
  assert.equal(changed.goals.find(g=>g.activity_key==='custom:Climbing').goal,2);assert.equal(changed.pending_goals.find(g=>g.activity_key==='custom:Climbing').goal,4);
  await assert.rejects(()=>rpc(db,'cs_settings',['days',{schedules:[{activity_key:'gym',days:[1],time:'morning'}]}]),/INVALID_ACTIVITY/);
  assert.equal((await rpc(db,'cs_snapshot')).usual_days.length,3);
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Peer',selected:['gym'],goals:{gym:1}}]);await assert.rejects(()=>db.query('select * from classstreak.activity_schedules'));
 }finally{await db.close();}
});
test('Demo board has eight scoped regulars, three friends; custom reactions toggle and comments persist',async()=>{
 const db=await fresh();try{
  await actor(db,A);let s=await rpc(db,'cs_bootstrap',[{first_name:'Tester',selected:['reformer'],goals:{reformer:2},place:{name:'Synthetic Pilates',activity_key:'reformer',lat:0,lng:0,radius_m:100}}]);
  s=await rpc(db,'cs_seed_demo',[false,[]]);assert.equal(s.friends.length,3);
  const venue=s.places[0].venue_id;const board=await rpc(db,'cs_studio',[venue]);assert.equal(board.demo_board,true);assert.equal(board.regulars,8);assert.equal(board.board.length,8);
  assert.equal((await db.query('select * from public.cs_venue_board()')).rows.length,0);
  const peer=s.friends[0];assert.ok(peer.week_details.length);assert.equal(peer.week_details[0].started_at,undefined);assert.equal(peer.week_details[0].place_id,undefined);
  const id=s.feed.find(f=>f.user_id===peer.id).id;
  s=await rpc(db,'cs_social',['reaction',{session_id:id,emoji:'💪'}]);assert.ok(s.feed.find(f=>f.id===id).reactions.some(r=>r.emoji==='💪'&&r.mine));
  s=await rpc(db,'cs_social',['reaction',{session_id:id,emoji:'💪'}]);assert.ok(!s.feed.find(f=>f.id===id).reactions.some(r=>r.mine));
  s=await rpc(db,'cs_social',['comment',{session_id:id,body:'You got this!'}]);assert.ok(s.feed.find(f=>f.id===id).comments.some(c=>c.body==='You got this!'));
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Peer',selected:['gym'],goals:{gym:1}}]);const other=await rpc(db,'cs_studio',[venue]);assert.equal(other.demo_board,undefined);assert.equal(other.board.length,0);
  await actor(db,A);await rpc(db,'cs_seed_demo',[true,[]]);assert.equal((await rpc(db,'cs_studio',[venue])).demo_board,undefined);
 }finally{await db.close();}
});
