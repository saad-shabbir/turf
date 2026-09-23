-- Keep expired event evidence on the phone; never rebind it to a new token.
create function public.cs_capture_status(capture_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); d classstreak.tracking_devices;
begin
 select * into d from classstreak.tracking_devices where user_id=u;
 return jsonb_build_object('matches',d.user_id is not null and d.token is not distinct from capture_token,
 'active',coalesce(d.active,false),'started_at',d.started_at,'stopped_at',d.stopped_at,'server_time',now());
end $$;
revoke all on function public.cs_capture_status(uuid) from public,anon;
grant execute on function public.cs_capture_status(uuid) to authenticated;
-- Preserve minimum duration, suppression, deduplication, daily caps and owner isolation.
-- Distance-triggered GPS speed is not a representative whole-visit measurement.
create or replace function classstreak.close_visit(u uuid, at_time timestamptz, estimated boolean default false, median_speed double precision default null, visit_source text default 'geofence') returns uuid language plpgsql security definer set search_path='' as $$
declare c classstreak.visit_candidates; p classstreak.places; duration integer; minimum integer; z text; result uuid; started_day date; begin
 select * into c from classstreak.visit_candidates where user_id=u and source=visit_source for update;
 if not found then return null; end if;
 if at_time<c.entered_at then delete from classstreak.visit_candidates where user_id=u and source=visit_source;return null;end if;
 select * into p from classstreak.places where id=c.place_id;
 select min_minutes*60 into minimum from classstreak.activities where key=c.activity_key;
 duration:=least(14400,floor(extract(epoch from at_time-c.entered_at))::integer);
 select tz into z from classstreak.users where id=u;
 started_day:=(c.entered_at at time zone z)::date;
 if duration>=minimum and not exists(
  select 1 from classstreak.suppressions where user_id=u and place_id=c.place_id and weekday=(extract(isodow from c.entered_at at time zone z)::integer-1)
   and hour=extract(hour from c.entered_at at time zone z)::integer and expires_at>now()
 ) and not exists(select 1 from classstreak.sessions where user_id=u and place_id=c.place_id and source=c.source and abs(extract(epoch from started_at-c.entered_at))<=300) then
  perform classstreak.ensure_week(u,c.entered_at);
  insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,estimated,week_key,day_key,event_key)
   values(u,c.place_id,c.venue_id,c.activity_key,c.workout_label,c.entered_at,c.entered_at+make_interval(secs=>duration),duration,c.source,estimated,
    classstreak.monday(c.entered_at,z),started_day,c.source||':'||c.place_id::text||':'||c.entered_at::text) returning id into result;
  perform classstreak.recount(u);
 end if;
 delete from classstreak.visit_candidates where user_id=u and source=visit_source;
 return result;
end $$;
