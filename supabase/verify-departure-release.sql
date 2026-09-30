-- Read-only release verification. Compare counts with the saved pre-update audit.
-- No account details, locations, session contents or credentials are returned.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from classstreak.users where not is_demo) as real_profiles,
       (select count(*) from classstreak.sessions) as sessions,
       (select count(*) from classstreak.places) as places;

with functions as (
 select to_regprocedure('public.cs_ingest(jsonb,uuid)') as ingest,
        to_regprocedure('public.cs_studio_live(uuid)') as live_studio,
        to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') as rollback
)
select coalesce(position('recovered' in pg_get_functiondef(ingest))>0
                and position('workout_started_at' in pg_get_functiondef(ingest))>0, false) as recovery_guard_present,
       live_studio is not null as live_studio_present,
       rollback is not null as rollback_present,
       ingest is not null and not coalesce(has_function_privilege('anon',ingest,'EXECUTE'),true) as anonymous_ingest_blocked,
       coalesce(has_function_privilege('authenticated',ingest,'EXECUTE'),false) as authenticated_ingest_allowed,
       live_studio is not null and not coalesce(has_function_privilege('anon',live_studio,'EXECUTE'),true) as anonymous_studio_blocked,
       coalesce(has_function_privilege('authenticated',live_studio,'EXECUTE'),false) as authenticated_studio_allowed,
       rollback is not null and not coalesce(has_function_privilege('anon',rollback,'EXECUTE'),true)
          and not coalesce(has_function_privilege('authenticated',rollback,'EXECUTE'),true) as rollback_private,
       exists(select 1 from pg_constraint
              where conrelid='classstreak.user_activities'::regclass
                and conname='user_activities_goal_check'
                and position('goal >= 0' in pg_get_constraintdef(oid))>0
                and position('goal <= 7' in pg_get_constraintdef(oid))>0) as weekly_goal_zero_to_seven
from functions;
