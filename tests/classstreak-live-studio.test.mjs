import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('live studios exclude legacy demo fixtures while preserving real ranking, visit totals and privacy',async()=>{
 const db=await fresh();try{
  await actor(db,A);const setup=await rpc(db,'cs_bootstrap',[{first_name:'Alice',last_name:'Private',selected:['gym'],goals:{gym:2},place:{name:'Synthetic Gym',activity_key:'gym',lat:0,lng:0,radius_m:100}}]);const p=setup.places[0];
  await rpc(db,'cs_seed_demo',[false,[]]);const old=await rpc(db,'cs_studio',[p.venue_id]);assert.equal(old.demo_board,true);assert.equal(old.board.length,8);
  let live=await rpc(db,'cs_studio_live',[p.venue_id]);assert.equal(live.demo_board,false);assert.equal(live.sample_visits,false);assert.equal(live.visits,0);assert.equal(live.next_milestone,1);assert.equal(live.board.length,0);
  await db.exec('reset role');
  for(const [source,minutes,ago] of [['geofence',40,1],['manual',10,1],['simulated',45,2],['geofence',2,3]])await db.query("insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key) values($1,$2,$3,'gym','Weights',now()-make_interval(days=>$4::integer)-interval '2 hours',now()-make_interval(days=>$4::integer)-interval '2 hours'+make_interval(mins=>$5::integer),$5::integer*60,$6,false,((now()-make_interval(days=>$4::integer)) at time zone 'America/Los_Angeles')::date,classstreak.monday(now()-make_interval(days=>$4::integer),'America/Los_Angeles'))",[setup.profile.id,p.id,p.venue_id,ago,minutes,source]);
  await actor(db,A);live=await rpc(db,'cs_studio_live',[p.venue_id]);assert.equal(live.visits,1);assert.equal(live.next_milestone,10);assert.equal(live.demo_board,false);
  assert.equal((await rpc(db,'cs_studio',[p.venue_id])).demo_board,true);
  assert.ok(live.board.every(row=>!['Amara D.','Lena D.','Riley D.'].includes(row.name)));assert.ok(live.board.every(row=>row.auth_id===undefined&&row.user_id===undefined&&row.first_name===undefined));
  await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'Bob',selected:['gym'],goals:{gym:1}}]);const other=await rpc(db,'cs_studio_live',[p.venue_id]);assert.equal(other.visits,0);assert.equal(other.sample_visits,false);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{show_on_board:false}]);await actor(db,B);assert.equal((await rpc(db,'cs_studio_live',[p.venue_id])).board.length,0);
  await actor(db,null);await assert.rejects(rpc(db,'cs_studio_live',[p.venue_id]),/permission denied/);
 }finally{await db.close();}
});
