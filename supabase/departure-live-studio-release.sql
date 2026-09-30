-- Apply only after the read-only audit confirms project qrehonivhqcgfrjcpzqk,
-- migration012 and the absence of this release. No stored data is changed.
begin;
do $$declare definition text;begin
 if not exists(select 1 from pg_constraint where conrelid='classstreak.user_activities'::regclass and conname='user_activities_goal_check' and position('goal <= 4' in pg_get_constraintdef(oid))>0) then raise exception 'Expected 0-4 goal baseline; inspect before continuing';end if;
 if to_regprocedure('public.cs_capture_status(uuid)') is null then raise exception 'Expected migration 012 before this release';end if;
 if to_regprocedure('public.cs_studio_before_demo_board(uuid)') is null then raise exception 'Expected studio baseline';end if;
 if to_regprocedure('public.cs_studio_live(uuid)') is not null or to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') is not null then raise exception 'Release or backup already exists; inspect before continuing';end if;
 definition:=pg_get_functiondef('public.cs_ingest(jsonb,uuid)'::regprocedure);
 if position('recovered' in definition)>0 or position('arrival_id' in definition)=0 then raise exception 'Unexpected ingest baseline; inspect first';end if;
 -- Retain the actual deployed implementation, not an assumed older copy.
 execute replace(definition,'FUNCTION public.cs_ingest(','FUNCTION public.cs_ingest_before_departure_recovery(');
 execute 'revoke all on function public.cs_ingest_before_departure_recovery(jsonb,uuid) from public,anon,authenticated';
end $$;

-- Optional, arrival-bound GPS departure confirmation. No capture/owner change.
-- Old clients keep their existing ENTER / EXIT protocol. Recovered times are estimates.
create or replace function public.cs_ingest(events jsonb, capture_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); e jsonb; p classstreak.places; c classstreak.visit_candidates; device classstreak.tracking_devices;
 at_time timestamptz; src text; kind text; eid uuid; sid uuid; accepted jsonb:='[]'; created jsonb:='[]'; z text; armed boolean; begin
 if jsonb_typeof(events)<>'array' or jsonb_array_length(events)>50 then raise exception 'INVALID_BATCH';end if;
 perform 1 from classstreak.users where id=u for update; select tz into z from classstreak.users where id=u;
 select * into device from classstreak.tracking_devices where user_id=u;
 for e in select * from jsonb_array_elements(events) loop
  eid:=(e->>'event_id')::uuid;at_time:=(e->>'observed_at')::timestamptz;src:=coalesce(e->>'source','geofence');kind:=e->>'kind';
  if src not in ('geofence','simulated') or kind not in ('ENTER','EXIT','TIMEOUT','SELECT','RESTART','STOP') then raise exception 'INVALID_EVENT';end if;
  if src='geofence' and (device.token is distinct from capture_token or device.user_id is null or (not device.active and at_time>device.stopped_at) or at_time<device.started_at-interval '5 minutes' or at_time>now()+interval '2 minutes' or at_time<now()-interval '30 days') then raise exception 'CAPTURE_EXPIRED';end if;
  if src='simulated' and (at_time>now()+interval '370 days' or at_time<now()-interval '370 days') then raise exception 'INVALID_TIME';end if;
  if exists(select 1 from classstreak.processed_events where user_id=u and event_id=eid) then accepted:=accepted||to_jsonb(eid);continue;end if;
  select * into p from classstreak.places where id=(e->>'place_id')::uuid and user_id=u;
  if not found then raise exception 'FORBIDDEN';end if;
  if src='geofence' and not p.enabled then raise exception 'PLACE_DISABLED';end if;
  select * into c from classstreak.visit_candidates where user_id=u and source=src;
  if coalesce((e->>'recovered')::boolean,false) then
   if kind<>'EXIT' or src<>'geofence' then raise exception 'INVALID_EVENT';end if;
   -- A delayed location confirmation belongs to one arrival and one timer start.
   -- It must not close/re-arm a newer workout, including after a timer restart.
   if c.user_id is null or c.place_id<>p.id or c.arrival_id is distinct from (e->>'visit_id')::uuid
    or c.entered_at is distinct from (e->>'workout_started_at')::timestamptz or at_time<c.entered_at then
    insert into classstreak.processed_events values(u,eid,at_time);
    accepted:=accepted||to_jsonb(eid);continue;
   end if;
  end if;
  if c.user_id is not null and at_time>=c.entered_at+interval '4 hours' then
   sid:=classstreak.close_visit(u,c.entered_at+interval '4 hours',true,null,src);
   if sid is not null then created:=created||to_jsonb(sid);end if;
   c:=null;
  end if;
  if kind in ('SELECT','RESTART','STOP') then
   -- Bind controls to the original arrival, never whichever visit happens to be open.
   if src<>'geofence' then raise exception 'INVALID_EVENT';end if;
   if c.user_id is not null and c.place_id=p.id and c.arrival_id=(e->>'visit_id')::uuid and at_time>=c.entered_at then
    if kind='SELECT' then
     perform classstreak.register_activity(e->>'activity_key');
     update classstreak.visit_candidates set activity_key=e->>'activity_key',workout_label=(select label from classstreak.activities where key=e->>'activity_key') where user_id=u and source=src;
    elsif kind='RESTART' then
     update classstreak.visit_candidates set entered_at=at_time where user_id=u and source=src;
    else
     sid:=classstreak.stop_workout(u,at_time,false,(e->>'median_speed')::double precision,src);
     if sid is not null then created:=created||to_jsonb(sid);end if;
     update classstreak.region_state set outside_seen=false where user_id=u and place_id=p.id and token=capture_token;
    end if;
   end if;
  elsif kind='EXIT' then
   insert into classstreak.region_state values(u,p.id,coalesce(capture_token,'00000000-0000-0000-0000-000000000000'),true)
    on conflict(user_id,place_id) do update set outside_seen=true,token=excluded.token;
   if c.place_id=p.id and c.source=src then
    sid:=classstreak.close_visit(u,at_time,coalesce((e->>'recovered')::boolean,false),(e->>'median_speed')::double precision,src);
    if sid is not null then created:=created||to_jsonb(sid);end if;
   end if;
  elsif kind='ENTER' and c.user_id is null then
   select outside_seen into armed from classstreak.region_state where user_id=u and place_id=p.id and token=capture_token;
   if src='simulated' or coalesce(armed,false) then
    insert into classstreak.visit_candidates(user_id,place_id,entered_at,source,activity_key,workout_label,venue_id,token,arrival_id)
     values(u,p.id,at_time,src,p.activity_key,coalesce(p.last_workout_label,(select label from classstreak.activities where key=p.activity_key)),p.venue_id,capture_token,eid);
    if src='geofence' then update classstreak.region_state set outside_seen=false where user_id=u and place_id=p.id and token=capture_token;end if;
   end if;
  end if;
  insert into classstreak.processed_events values(u,eid,at_time);
  accepted:=accepted||to_jsonb(eid);
 end loop;
 update classstreak.tracking_devices set last_seen=now() where user_id=u and token=capture_token;
 return jsonb_build_object('accepted',accepted,'created',created,'server_time',now());
end $$;

-- A separate real-data RPC lets older apps retain their explicit sample walkthrough.
-- This does not delete seeds, change friendships, or expose stable profile IDs.
create function public.cs_studio_live(venue_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;n integer;next_milestone integer;
begin
 result:=public.cs_studio_before_demo_board(venue_id);
 -- Legacy demo data can own the old counted flag for a day. Rank real eligible
 -- sessions independently, using the same day/activity rule as the public board.
 with real_visits as (
  select s.*,row_number() over(partition by day_key,activity_key order by started_at,id) ordinal
  from classstreak.sessions s where s.user_id=u and s.source in('geofence','manual')
   and s.removed_at is null and s.started_at<=now()
   and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key))
 ) select count(*) into n from real_visits s where s.venue_id=cs_studio_live.venue_id and s.ordinal=1;
 select min(x) into next_milestone from unnest(array[1,10,25,50,100,250]) x where x>n;
 return result||jsonb_build_object('visits',n,'next_milestone',coalesce(next_milestone,500),'sample_visits',false,'demo_board',false);
end $$;
revoke all on function public.cs_studio_live(uuid) from public,anon;
grant execute on function public.cs_studio_live(uuid) to authenticated;

-- One counted workout per activity per day means an exact weekly goal is 0–7.
-- Broaden validation only; retain all existing preferences and historical weeks.
alter table classstreak.user_activities drop constraint user_activities_goal_check;
alter table classstreak.user_activities add constraint user_activities_goal_check check(goal between 0 and 7);

do $$begin
 if not exists(select 1 from pg_constraint where conrelid='classstreak.user_activities'::regclass and conname='user_activities_goal_check' and position('goal <= 7' in pg_get_constraintdef(oid))>0) then raise exception 'Expected exact goal range 0-7';end if;
 if has_function_privilege('anon','public.cs_studio_live(uuid)','EXECUTE') or has_function_privilege('anon','public.cs_ingest(jsonb,uuid)','EXECUTE') then raise exception 'Unexpected anonymous access';end if;
 if not has_function_privilege('authenticated','public.cs_studio_live(uuid)','EXECUTE') or not has_function_privilege('authenticated','public.cs_ingest(jsonb,uuid)','EXECUTE') then raise exception 'Expected authenticated access';end if;
end $$;
commit;
