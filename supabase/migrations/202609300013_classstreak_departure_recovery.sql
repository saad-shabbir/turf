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
