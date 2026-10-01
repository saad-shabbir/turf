import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fresh,actor,rpc,A,B} from './database-harness.mjs';
test('Photo paths require a real own session, attachment checks upload, and revocation applies to downloads',async()=>{
 const db=await fresh();try{
  await actor(db,A);const a=await rpc(db,'cs_bootstrap',[{first_name:'Alice',selected:['gym'],goals:{gym:2},tz:'UTC'}]);const saved=await rpc(db,'cs_settings',['place',{name:'Fixture',activity_key:'gym',lat:0,lng:0,radius_m:100}]);
  const s=await rpc(db,'cs_session',['manual',{place_id:saved.places[0].id,activity_key:'gym',started_at:new Date(Date.now()-3600000).toISOString(),minutes:40}]);const id=s.sessions[0].id;const path=`${A}/${id}/${randomUUID()}.jpg`;
  await assert.rejects(()=>rpc(db,'cs_attach_photo',[id,path,'Hi']),/PHOTO_NOT_UPLOADED/);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',path]);await rpc(db,'cs_attach_photo',[id,path,'Hi']);
  await actor(db,B);const b=await rpc(db,'cs_bootstrap',[{first_name:'Bob',selected:['gym'],goals:{gym:2}}]);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classstreak-photos',`${A}/${id}/${randomUUID()}.jpg`]));
  await rpc(db,'cs_social',['invite',{code:a.profile.invite_code}]);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await actor(db,A);await rpc(db,'cs_social',['remove',{id:b.profile.id}]);await actor(db,B);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 }finally{await db.close();}
});
