import {test} from 'node:test';import assert from 'node:assert/strict';import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Venue boards coalesce places, exclude samples, count real visits independently and honor opt-out',async()=>{
 const db=await fresh();try{
  await actor(db,A);let a=await rpc(db,'cs_bootstrap',[{first_name:'Alice',last_name:'Private',selected:['gym'],goals:{gym:2},place:{id:'',name:'Synthetic Gym',activity_key:'gym',lat:0,lng:0,radius_m:100}}]);const p=a.places[0];
  await actor(db,B);const b=await rpc(db,'cs_bootstrap',[{first_name:'Bob',last_name:'Hidden',selected:['gym'],goals:{gym:2},place:{name:'Synthetic Gym',activity_key:'gym',lat:0.0001,lng:0,radius_m:150}}]);assert.equal(p.venue_id,b.places[0].venue_id);
  await db.exec('reset role');for(const source of ['seed','simulated','geofence'])await db.query("insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,counted,day_key,week_key) values($1,$2,$3,'gym','Legs',now()-interval '1 hour',now()-interval '20 minutes',2400,$4,false,(now() at time zone 'America/Los_Angeles')::date,classstreak.monday(now(),'America/Los_Angeles'))",[a.profile.id,p.id,p.venue_id,source]);
  await actor(db,B);let board=await rpc(db,'cs_studio',[p.venue_id]);assert.equal(board.board.length,1);assert.equal(board.board[0].name,'Alice P.');assert.equal(board.board[0].weekly_count,1);assert.equal(board.board[0].auth_id,undefined);assert.equal(board.board[0].user_id,undefined);
  await actor(db,A);await rpc(db,'cs_settings',['profile',{show_on_board:false}]);await actor(db,B);assert.equal((await rpc(db,'cs_studio',[p.venue_id])).board.length,0);
  await actor(db,A);const code=await rpc(db,'cs_share_studio',[p.id]);await actor(db,null);const shared=await rpc(db,'cs_studio_preview',[code]);assert.equal(shared.name,'Synthetic Gym');assert.equal(shared.id,undefined);assert.equal(await rpc(db,'cs_studio_preview',[p.venue_id]),null);
 }finally{await db.close();}
});
