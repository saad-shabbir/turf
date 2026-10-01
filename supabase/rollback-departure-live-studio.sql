-- Emergency rollback only. Review and coordinate with the app release first.
-- Keeps all records; restores prior ingest, friendship summaries and social RPC.
begin;
do $$declare definition text;begin
 if to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') is null then raise exception 'No verified rollback exists';end if;
 if to_regprocedure('public.cs_social_before_friend_profile(text,jsonb)') is null or to_regprocedure('classstreak.friend_list_before_friend_profile(uuid)') is null then raise exception 'No verified friend rollback exists';end if;
 definition:=pg_get_functiondef('public.cs_ingest_before_departure_recovery(jsonb,uuid)'::regprocedure);
 execute replace(definition,'FUNCTION public.cs_ingest_before_departure_recovery(','FUNCTION public.cs_ingest(');
 definition:=pg_get_functiondef('classstreak.friend_list_before_friend_profile(uuid)'::regprocedure);
 execute replace(definition,'FUNCTION classstreak.friend_list_before_friend_profile(','FUNCTION classstreak.friend_list(');
 definition:=pg_get_functiondef('public.cs_social_before_friend_profile(text,jsonb)'::regprocedure);
 execute replace(definition,'FUNCTION public.cs_social_before_friend_profile(','FUNCTION public.cs_social(');
end $$;
-- Disable the new profile endpoint so it cannot advertise the reverted nudge rule.
revoke all on function public.cs_friend_profile(uuid) from public,anon,authenticated;
revoke all on function public.cs_social(text,jsonb) from public,anon;
grant execute on function public.cs_social(text,jsonb) to authenticated;
-- cs_studio_live is read-only and can safely remain available to the new app.
-- Keep the broader 0–7 goal constraint. Tightening it could reject or destroy
-- valid goals saved after release; no user preferences are clamped on rollback.
commit;
