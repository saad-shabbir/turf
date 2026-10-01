import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('timed manual saves are private, retryable, bounded, and never assert venue attendance',async()=>{
 const db=await fresh();try{
 await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'A',selected:['gym'],goals:{gym:3}}]);
 const payload={auth_owner:A,id:randomUUID(),activity_key:'gym',started_at:new Date(Date.now()-3600000).toISOString(),ended_at:new Date(Date.now()-60000).toISOString(),place_id:null};
 let s=await rpc(db,'cs_timed_session',[payload]);assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].source,'manual');assert.equal(s.sessions[0].verified,false);assert.equal(s.sessions[0].place_id,null);
 s=await rpc(db,'cs_timed_session',[payload]);assert.equal(s.sessions.length,1);
 await actor(db,B);await rpc(db,'cs_bootstrap',[{first_name:'B',selected:['gym'],goals:{gym:3}}]);await assert.rejects(()=>rpc(db,'cs_timed_session',[payload]),/AUTH_REQUIRED/);
 await assert.rejects(()=>rpc(db,'cs_timed_session',[{...payload,auth_owner:B}]),/FORBIDDEN/);
 await actor(db,A);await assert.rejects(()=>rpc(db,'cs_timed_session',[{...payload,id:randomUUID(),ended_at:new Date(Date.now()+60000).toISOString()}]),/INVALID_SESSION/);
 await assert.rejects(()=>rpc(db,'cs_timed_session',[{...payload,id:randomUUID(),place_id:randomUUID()}]),/FORBIDDEN/);
 const second=await rpc(db,'cs_timed_session',[{...payload,id:randomUUID(),activity_key:'custom:Climbing'}]);assert.equal(second.sessions.length,2);
 await actor(db,null);await assert.rejects(()=>rpc(db,'cs_timed_session',[payload]),/permission denied/);
 }finally{await db.close();}
});
