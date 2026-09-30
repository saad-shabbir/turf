import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,actor,rpc,A} from './database-harness.mjs';
test('incremental release retains revoked rollbacks and restores ingest and social rules without deleting data',async()=>{
 const db=await fresh();try{
  // Disposable-only fixture restores the pre-release function shape.
  const previous=await readFile('supabase/migrations/202609220011_classstreak_active_workout.sql','utf8');
  await db.exec(previous.slice(previous.indexOf('create or replace function public.cs_ingest'),previous.indexOf('\nrevoke all on function classstreak.stop_workout')));
  await db.exec('drop function public.cs_studio_live(uuid)');
  await db.exec(`drop function public.cs_friend_profile(uuid);drop function public.cs_social(text,jsonb);
   drop function classstreak.friend_list(uuid);drop function classstreak.real_friend_streak(uuid);
   drop function classstreak.nudge_available(uuid,uuid);drop function classstreak.worked_out_today(uuid);
   alter function public.cs_social_before_friend_profile(text,jsonb) rename to cs_social;
   alter function classstreak.friend_list_before_friend_profile(uuid) rename to friend_list;
   grant execute on function public.cs_social(text,jsonb) to authenticated;`);
  await db.exec('alter table classstreak.user_activities drop constraint user_activities_goal_check;alter table classstreak.user_activities add constraint user_activities_goal_check check(goal between 0 and 4)');
  await actor(db,A);await rpc(db,'cs_bootstrap',[{first_name:'Existing',selected:['gym'],goals:{gym:3}}]);await db.exec('reset role');
  const fingerprint="select md5(pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure)) hash,md5(pg_get_functiondef('public.cs_social(text,jsonb)'::regprocedure)) social_hash,md5(pg_get_functiondef('classstreak.friend_list(uuid)'::regprocedure)) friend_hash,(select count(*) from auth.users) users";
  const before=(await db.query(fingerprint)).rows[0];
  await db.exec(await readFile('supabase/departure-live-studio-release.sql','utf8'));
  let result=(await db.query("select has_function_privilege('authenticated','public.cs_ingest_before_departure_recovery(jsonb,uuid)','EXECUTE') backup_access,has_function_privilege('anon','public.cs_studio_live(uuid)','EXECUTE') anonymous_live_access,position('recovered' in pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure))>0 recovery")).rows[0];
  assert.equal(result.backup_access,false);assert.equal(result.anonymous_live_access,false);assert.equal(result.recovery,true);
  const verification=await db.exec(await readFile('supabase/verify-departure-release.sql','utf8'));
  assert.ok(Object.values(verification[0].rows[0].release_verification.checks).every(value=>value===true),'release guide verification must report every security/schema check true');
  const audit=await db.exec(await readFile('supabase/audit-departure-recovery.sql','utf8'));
  assert.equal(audit.length,1);assert.equal(audit[0].rows[0].release_audit.has_recovery_guard,true);assert.equal(audit[0].rows[0].release_audit.has_friend_profile,true);assert.equal(audit[0].rows[0].release_audit.has_friend_rollback,true);
  await actor(db,A);let setup=await rpc(db,'cs_snapshot');assert.equal(setup.goals[0].goal,3);assert.deepEqual(setup.pending_goals,[]);
  setup=await rpc(db,'cs_settings',['goals',{goals:[{activity_key:'gym',goal:7}]}]);assert.equal(setup.pending_goals[0].goal,7);await db.exec('reset role');
  await db.exec(await readFile('supabase/rollback-departure-live-studio.sql','utf8'));
  result=(await db.query(fingerprint)).rows[0];
  assert.deepEqual(result,before);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.cs_friend_profile(uuid)','EXECUTE') profile_access")).rows[0].profile_access,false);
  await actor(db,A);setup=await rpc(db,'cs_snapshot');assert.equal(setup.goals[0].goal,3);assert.equal(setup.pending_goals[0].goal,7);
 }finally{await db.close();}
});
