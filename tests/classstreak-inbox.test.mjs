import {test} from 'node:test';import assert from 'node:assert/strict';import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Nudges require an accepted friend, eligible usual day, and are capped once per friend per local day',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'Alice',selected:['gym'],goals:{gym:2}}]);await actor(db,B);
  // Choose a real timezone where the fixture instant is 19:xx, without changing the server clock.
  let offset=19-new Date().getUTCHours();if(offset>14)offset-=24;const tz=offset===0?'UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
  const d=(new Date(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00Z').getUTCDay()+6)%7;
  const b=await rpc(db,'cs_bootstrap',[{first_name:'Bob',selected:['gym'],goals:{gym:2},tz,days:[d],time:'evening'}]);await actor(db,A);
  await assert.rejects(()=>rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);await rpc(db,'cs_social',['invite',{code:b.profile.invite_code}]);
  await rpc(db,'cs_social',['nudge',{id:b.profile.id}]);await assert.rejects(()=>rpc(db,'cs_social',['nudge',{id:b.profile.id}]),/NUDGE_UNAVAILABLE/);
  await actor(db,B);let s=await rpc(db,'cs_snapshot');assert.equal(s.inbox.filter(i=>i.kind==='nudge').length,1);assert.match(s.inbox[0].body,/Alice/);
  await rpc(db,'cs_settings',['inbox_read',{}]);s=await rpc(db,'cs_snapshot');assert.ok(s.inbox[0].read_at);
  await db.exec('reset role');const rev=(await db.query('select * from public.cs_revisions where auth_id=$1',[B])).rows[0];assert.ok(rev.revision>0);
  await actor(db,A);assert.equal((await db.query('select * from public.cs_revisions where auth_id=$1',[B])).rows.length,0);assert.ok(a.profile.id);
 }finally{await db.close();}
});
