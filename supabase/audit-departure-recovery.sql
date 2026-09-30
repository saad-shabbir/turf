-- Read-only metadata / counts. Does not expose tokens, user emails, coordinates or sessions.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from classstreak.users where not is_demo) as real_profiles,
       (select count(*) from classstreak.sessions) as sessions,
       (select count(*) from classstreak.places) as places,
       to_regprocedure('public.cs_capture_status(uuid)') is not null as has_012_capture_status,
       to_regprocedure('public.cs_studio_live(uuid)') is not null as has_live_studio,
       to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') is not null as has_rollback;
select md5(pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure)) as ingest_definition_hash,
       position('recovered' in pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure))>0 as has_recovery_guard,
       position('median_speed<2' in pg_get_functiondef('classstreak.close_visit(uuid,timestamptz,boolean,double precision,text)'::regprocedure))=0 as has_drive_away_fix,
       has_function_privilege('anon','public.cs_ingest(jsonb,uuid)','EXECUTE') as anonymous_ingest,
       has_function_privilege('authenticated','public.cs_ingest(jsonb,uuid)','EXECUTE') as authenticated_ingest;
select tablename from pg_tables where schemaname='public' order by tablename;
select pg_get_constraintdef(oid) as exact_weekly_goal_constraint
from pg_constraint where conrelid='classstreak.user_activities'::regclass and conname='user_activities_goal_check';
