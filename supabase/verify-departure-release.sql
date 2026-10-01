-- Read-only release verification. Compare counts with the saved pre-update audit.
-- No account details, locations, session contents or credentials are returned.
with functions as (
 select to_regprocedure('public.cs_ingest(jsonb,uuid)') as ingest,
        to_regprocedure('public.cs_studio_live(uuid)') as live_studio,
        to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') as rollback,
        to_regprocedure('public.cs_friend_profile(uuid)') as friend_profile,
        to_regprocedure('public.cs_social(text,jsonb)') as social,
        to_regprocedure('public.cs_social_before_friend_profile(text,jsonb)') as social_rollback,
        to_regprocedure('classstreak.friend_list_before_friend_profile(uuid)') as friend_rollback
), checks as (
select coalesce(position('recovered' in pg_get_functiondef(ingest))>0
                and position('workout_started_at' in pg_get_functiondef(ingest))>0, false) as recovery_guard_present,
       live_studio is not null as live_studio_present,
       rollback is not null as rollback_present,
       friend_profile is not null as friend_profile_present,
       coalesce(position('classstreak.nudge_available' in pg_get_functiondef(social))>0, false) as any_day_nudge_present,
       ingest is not null and not coalesce(has_function_privilege('anon',ingest,'EXECUTE'),true) as anonymous_ingest_blocked,
       coalesce(has_function_privilege('authenticated',ingest,'EXECUTE'),false) as authenticated_ingest_allowed,
       live_studio is not null and not coalesce(has_function_privilege('anon',live_studio,'EXECUTE'),true) as anonymous_studio_blocked,
       coalesce(has_function_privilege('authenticated',live_studio,'EXECUTE'),false) as authenticated_studio_allowed,
       rollback is not null and not coalesce(has_function_privilege('anon',rollback,'EXECUTE'),true)
          and not coalesce(has_function_privilege('authenticated',rollback,'EXECUTE'),true) as rollback_private,
       friend_profile is not null and not coalesce(has_function_privilege('anon',friend_profile,'EXECUTE'),true) as anonymous_friend_profile_blocked,
       coalesce(has_function_privilege('authenticated',friend_profile,'EXECUTE'),false) as authenticated_friend_profile_allowed,
       social is not null and not coalesce(has_function_privilege('anon',social,'EXECUTE'),true) as anonymous_social_blocked,
       coalesce(has_function_privilege('authenticated',social,'EXECUTE'),false) as authenticated_social_allowed,
       social_rollback is not null and friend_rollback is not null
          and not coalesce(has_function_privilege('anon',social_rollback,'EXECUTE'),true)
          and not coalesce(has_function_privilege('authenticated',social_rollback,'EXECUTE'),true)
          and not coalesce(has_function_privilege('anon',friend_rollback,'EXECUTE'),true)
          and not coalesce(has_function_privilege('authenticated',friend_rollback,'EXECUTE'),true) as friend_rollbacks_private,
       exists(select 1 from pg_constraint
              where conrelid='classstreak.user_activities'::regclass
                and conname='user_activities_goal_check'
                and position('goal >= 0' in pg_get_constraintdef(oid))>0
                and position('goal <= 7' in pg_get_constraintdef(oid))>0) as weekly_goal_zero_to_seven
from functions
)
select jsonb_build_object('counts',jsonb_build_object(
 'auth_users',(select count(*) from auth.users),
 'real_profiles',(select count(*) from classstreak.users where not is_demo),
 'sessions',(select count(*) from classstreak.sessions),
 'places',(select count(*) from classstreak.places)),
 'checks',(select to_jsonb(checks) from checks)) as release_verification;
