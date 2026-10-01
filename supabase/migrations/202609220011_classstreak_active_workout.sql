-- Arrival-bound workout controls. Preserve the existing capture token and outbox protocol.
alter table classstreak.visit_candidates add column arrival_id uuid;
create function classstreak.stop_workout(u uuid, at_time timestamptz, estimated boolean default false, median_speed double precision default null, visit_source text default 'geofence') returns uuid language plpgsql security definer set search_path='' as $$
declare c classstreak.visit_candidates; p classstreak.places; duration integer; minimum integer; z text; result uuid; started_day date; begin
 select * into c from classstreak.visit_candidates where user_id=u and source=visit_source for update;
 if not found then return null; end if;
 if at_time<c.entered_at then delete from classstreak.visit_candidates where user_id=u and source=visit_source;return null;end if;
 select * into p from classstreak.places where id=c.place_id;
 select min_minutes*60 into minimum from classstreak.activities where key=c.activity_key;
 duration:=least(14400,floor(extract(epoch from at_time-c.entered_at))::integer);
 select tz into z from classstreak.users where id=u;
 started_day:=(c.entered_at at time zone z)::date;
 if duration>=1 and (median_speed is null or median_speed<2) and not exists(
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
    sid:=classstreak.close_visit(u,at_time,false,(e->>'median_speed')::double precision,src);
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

revoke all on function classstreak.stop_workout(uuid,timestamptz,boolean,double precision,text) from public,anon,authenticated;

create or replace function classstreak.recount(u uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update classstreak.sessions s set counted=coalesce((s.removed_at is null and s.id=(select x.id from classstreak.sessions x join classstreak.activities a on a.key=x.activity_key where x.user_id=u and x.activity_key=s.activity_key and x.day_key=s.day_key and x.removed_at is null and (x.source='manual' or x.duration_sec>=a.min_minutes*60) order by x.started_at,x.id limit 1)),false) where s.user_id=u;
end $$;
