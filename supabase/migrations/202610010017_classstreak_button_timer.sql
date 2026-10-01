-- Timed, user-started workouts are manual/unverified; no claimed venue attendance.
-- Additive rollout. Rollback: revoke execute on public.cs_timed_session(jsonb)
-- from authenticated. Saved sessions remain recoverable and are never deleted.
create or replace function public.cs_timed_session(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); sid uuid; starts timestamptz; ends timestamptz; seconds integer; k text; label text; z text; p uuid; existing classstreak.sessions;
begin
 if u is null or (payload->>'auth_owner')::uuid is distinct from auth.uid() then raise exception 'AUTH_REQUIRED';end if;
 select tz into z from classstreak.users where id=u and not is_demo for update;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 sid:=(payload->>'id')::uuid;if sid is null then raise exception 'INVALID_SESSION';end if;
 select * into existing from classstreak.sessions where id=sid;
 if found then
  if existing.user_id<>u or existing.event_key is distinct from ('button:'||sid::text) then raise exception 'FORBIDDEN';end if;
  return public.cs_snapshot();
 end if;
 starts:=(payload->>'started_at')::timestamptz;ends:=(payload->>'ended_at')::timestamptz;
 seconds:=floor(extract(epoch from ends-starts))::integer;
 if starts is null or ends is null or starts>now() or starts<now()-interval '90 days' or ends>now() or seconds not between 60 and 14400 then raise exception 'INVALID_SESSION';end if;
 p:=(payload->>'place_id')::uuid;
 if p is not null and not exists(select 1 from classstreak.places where id=p and user_id=u) then raise exception 'FORBIDDEN';end if;
 k:=payload->>'activity_key';perform classstreak.register_activity(k);
 select a.label into label from classstreak.activities a where a.key=k;if label is null then raise exception 'INVALID_ACTIVITY';end if;
 perform classstreak.ensure_week(u,starts);
 insert into classstreak.sessions(id,user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,verified,week_key,day_key,event_key)
 values(sid,u,p,null,k,label,starts,ends,seconds,'manual',false,classstreak.monday(starts,z),(starts at time zone z)::date,'button:'||sid::text);
 perform classstreak.recount(u);return public.cs_snapshot();
end $$;
revoke all on function public.cs_timed_session(jsonb) from public,anon;
grant execute on function public.cs_timed_session(jsonb) to authenticated;
