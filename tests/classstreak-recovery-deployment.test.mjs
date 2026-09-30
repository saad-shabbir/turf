import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,actor,rpc,A} from './database-harness.mjs';
test('incremental release retains a revoked rollback and restores prior ingest without deleting data',async()=>{
 const db=await fresh();try{
  // Disposable-only fixture restores the pre-release function shape.
  const previous=await readFile('supabase/migrations/202609220011_classstreak_active_workout.sql','utf8');
  await db.exec(previous.slice(previous.indexOf('create or replace function public.cs_ingest'),previous.indexOf('\nrevoke all on function classstreak.stop_workout')));
  await db.exec('drop function public.cs_studio_live(uuid)');
  await db.exec('alter table classstreak.user_activities drop constraint user_activities_goal_check;alter table classstreak.user_activities add constraint user_activities_goal_check check(goal between 0 and 4)');
  await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'Existing',selected:['gym'],goals:{gym:3}}]);await db.exec('reset role');
  const before=(await db.query("select md5(pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure)) hash,(select count(*) from auth.users) users")).rows[0];
  await db.exec(await readFile('supabase/departure-live-studio-release.sql','utf8'));
  let result=(await db.query("select has_function_privilege('authenticated','public.cs_ingest_before_departure_recovery(jsonb,uuid)','EXECUTE') backup_access,has_function_privilege('anon','public.cs_studio_live(uuid)','EXECUTE') anonymous_live_access,position('recovered' in pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure))>0 recovery")).rows[0];
  assert.equal(result.backup_access,false);assert.equal(result.anonymous_live_access,false);assert.equal(result.recovery,true);
  const verification=await db.exec(await readFile('supabase/verify-departure-release.sql','utf8'));
  assert.ok(Object.values(verification[1].rows[0]).every(value=>value===true),'release guide verification must report every security/schema check true');
  await actor(db,A);let setup=await rpc(db,'cs_snapshot');assert.equal(setup.goals[0].goal,3);assert.deepEqual(setup.pending_goals,[]);
  setup=await rpc(db,'cs_settings',['goals',{goals:[{activity_key:'gym',goal:7}]}]);assert.equal(setup.pending_goals[0].goal,7);await db.exec('reset role');
  await db.exec(await readFile('supabase/rollback-departure-live-studio.sql','utf8'));
  result=(await db.query("select md5(pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure)) hash,(select count(*) from auth.users) users")).rows[0];
  assert.equal(result.hash,before.hash);assert.equal(result.users,before.users);
  await actor(db,A);setup=await rpc(db,'cs_snapshot');assert.equal(setup.goals[0].goal,3);assert.equal(setup.pending_goals[0].goal,7);
 }finally{await db.close();}
});
