-- One read-only result, so the dashboard cannot hide earlier result tables.
-- No tokens, emails, coordinates or session contents are returned.
select jsonb_build_object(
 'counts',jsonb_build_object(
  'auth_users',(select count(*) from auth.users),
  'real_profiles',(select count(*) from classstreak.users where not is_demo),
  'sessions',(select count(*) from classstreak.sessions),
  'places',(select count(*) from classstreak.places)),
 'has_012_capture_status',to_regprocedure('public.cs_capture_status(uuid)') is not null,
 'has_live_studio',to_regprocedure('public.cs_studio_live(uuid)') is not null,
 'has_rollback',to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') is not null,
 'ingest_definition_hash',md5(pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure)),
 'has_recovery_guard',position('recovered' in pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure))>0,
 'has_drive_away_fix',position('median_speed<2' in pg_get_functiondef('classstreak.close_visit(uuid,timestamptz,boolean,double precision,text)'::regprocedure))=0,
 'anonymous_ingest',has_function_privilege('anon','public.cs_ingest(jsonb,uuid)','EXECUTE'),
 'authenticated_ingest',has_function_privilege('authenticated','public.cs_ingest(jsonb,uuid)','EXECUTE'),
 'public_tables',(select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'),
 'exact_weekly_goal_constraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='classstreak.user_activities'::regclass and conname='user_activities_goal_check')
) as release_audit;
