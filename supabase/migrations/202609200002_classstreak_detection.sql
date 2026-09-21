create table classstreak.tracking_devices (
 user_id uuid primary key references classstreak.users on delete cascade, installation_id uuid not null, token uuid not null default gen_random_uuid(),
 active boolean not null default true, started_at timestamptz not null default now(), last_seen timestamptz not null default now()
);
create table classstreak.visit_candidates (
 user_id uuid references classstreak.users on delete cascade, place_id uuid not null references classstreak.places on delete cascade,
 entered_at timestamptz not null, source text not null, activity_key text not null, workout_label text not null, venue_id uuid, token uuid, speed_median double precision, primary key(user_id,source)
);
create table classstreak.processed_events (
 user_id uuid references classstreak.users on delete cascade, event_id uuid, observed_at timestamptz not null, primary key(user_id,event_id)
);
create table classstreak.region_state (
 user_id uuid references classstreak.users on delete cascade, place_id uuid references classstreak.places on delete cascade,
 token uuid not null, outside_seen boolean not null default false, primary key(user_id,place_id)
);
alter table classstreak.tracking_devices enable row level security;
alter table classstreak.visit_candidates enable row level security;
alter table classstreak.processed_events enable row level security;
alter table classstreak.region_state enable row level security;

create function classstreak.recount(u uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update classstreak.sessions s set counted=(s.removed_at is null and s.id=(select x.id from classstreak.sessions x where x.user_id=u and x.activity_key=s.activity_key and x.day_key=s.day_key and x.removed_at is null order by x.started_at,x.id limit 1)) where s.user_id=u;
end $$;
create function classstreak.close_visit(u uuid, at_time timestamptz, estimated boolean default false, median_speed double precision default null, visit_source text default 'geofence') returns uuid language plpgsql security definer set search_path='' as $$
declare c classstreak.visit_candidates; p classstreak.places; duration integer; minimum integer; z text; result uuid; started_day date; begin
 select * into c from classstreak.visit_candidates where user_id=u and source=visit_source for update;
 if not found then return null; end if;
 if at_time<c.entered_at then delete from classstreak.visit_candidates where user_id=u and source=visit_source;return null;end if;
 select * into p from classstreak.places where id=c.place_id;
 select min_minutes*60 into minimum from classstreak.activities where key=c.activity_key;
 duration:=least(14400,floor(extract(epoch from at_time-c.entered_at))::integer);
 select tz into z from classstreak.users where id=u;
 started_day:=(c.entered_at at time zone z)::date;
 if duration>=minimum and (median_speed is null or median_speed<2) and not exists(
  select 1 from classstreak.suppressions where user_id=u and place_id=c.place_id and weekday=(extract(isodow from c.entered_at at time zone z)::integer-1)
   and hour=extract(hour from c.entered_at at time zone z)::integer and expires_at>now()
 ) and not exists(select 1 from classstreak.sessions where user_id=u and place_id=c.place_id and abs(extract(epoch from started_at-c.entered_at))<=300) then
  perform classstreak.ensure_week(u,c.entered_at);
  insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,estimated,week_key,day_key,event_key)
   values(u,c.place_id,c.venue_id,c.activity_key,c.workout_label,c.entered_at,c.entered_at+make_interval(secs=>duration),duration,c.source,estimated,
    classstreak.monday(c.entered_at,z),started_day,c.place_id::text||':'||c.entered_at::text) returning id into result;
  perform classstreak.recount(u);
 end if;
 delete from classstreak.visit_candidates where user_id=u and source=visit_source;
 return result;
end $$;
create function public.cs_tracking(action text, installation uuid default null, capture_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); device classstreak.tracking_devices; begin
 perform 1 from classstreak.users where id=u for update;
 if action='start' then
  if not (select tracking_consent from classstreak.users where id=u) then raise exception 'CONSENT_REQUIRED';end if;
  if installation is null or not exists(select 1 from classstreak.places where user_id=u and enabled) then raise exception 'PLACE_REQUIRED';end if;
  insert into classstreak.tracking_devices(user_id,installation_id) values(u,installation)
   on conflict(user_id) do update set installation_id=excluded.installation_id,token=gen_random_uuid(),active=true,started_at=now(),last_seen=now()
   returning * into device;
  delete from classstreak.visit_candidates where user_id=u and source='geofence';
  delete from classstreak.region_state where user_id=u;
 elsif action='stop' then
  update classstreak.tracking_devices set active=false where user_id=u and token=capture_token;
  delete from classstreak.visit_candidates where user_id=u and token=capture_token;
 elsif action='status' then
  select * into device from classstreak.tracking_devices where user_id=u and active;
 else raise exception 'UNKNOWN_ACTION';end if;
 return to_jsonb(device);
end $$;
create function public.cs_ingest(events jsonb, capture_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); e jsonb; p classstreak.places; c classstreak.visit_candidates; device classstreak.tracking_devices;
 at_time timestamptz; src text; kind text; eid uuid; sid uuid; accepted jsonb:='[]'; created jsonb:='[]'; z text; armed boolean; begin
 if jsonb_typeof(events)<>'array' or jsonb_array_length(events)>50 then raise exception 'INVALID_BATCH';end if;
 perform 1 from classstreak.users where id=u for update; select tz into z from classstreak.users where id=u;
 select * into device from classstreak.tracking_devices where user_id=u;
 for e in select * from jsonb_array_elements(events) loop
  eid:=(e->>'event_id')::uuid;at_time:=(e->>'observed_at')::timestamptz;src:=coalesce(e->>'source','geofence');kind:=e->>'kind';
  if src not in ('geofence','simulated') or kind not in ('ENTER','EXIT','TIMEOUT') then raise exception 'INVALID_EVENT';end if;
  if src='geofence' and (not coalesce(device.active,false) or device.token is distinct from capture_token or at_time<device.started_at-interval '5 minutes' or at_time>now()+interval '2 minutes' or at_time<now()-interval '30 days') then raise exception 'CAPTURE_EXPIRED';end if;
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
  if kind='EXIT' then
   insert into classstreak.region_state values(u,p.id,coalesce(capture_token,'00000000-0000-0000-0000-000000000000'),true)
    on conflict(user_id,place_id) do update set outside_seen=true,token=excluded.token;
   if c.place_id=p.id and c.source=src then
    sid:=classstreak.close_visit(u,at_time,false,(e->>'median_speed')::double precision,src);
    if sid is not null then created:=created||to_jsonb(sid);end if;
   end if;
  elsif kind='ENTER' and c.user_id is null then
   select outside_seen into armed from classstreak.region_state where user_id=u and place_id=p.id and token=capture_token;
   if src='simulated' or coalesce(armed,false) then
    insert into classstreak.visit_candidates(user_id,place_id,entered_at,source,activity_key,workout_label,venue_id,token)
     values(u,p.id,at_time,src,p.activity_key,coalesce(p.last_workout_label,(select label from classstreak.activities where key=p.activity_key)),p.venue_id,capture_token);
   end if;
  end if;
  insert into classstreak.processed_events values(u,eid,at_time);
  accepted:=accepted||to_jsonb(eid);
 end loop;
 update classstreak.tracking_devices set last_seen=now() where user_id=u and token=capture_token;
 return jsonb_build_object('accepted',accepted,'created',created,'server_time',now());
end $$;
create function public.cs_session(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); s classstreak.sessions; p classstreak.places; z text; starts timestamptz; minutes integer; label text; begin
 perform 1 from classstreak.users where id=u for update;select tz into z from classstreak.users where id=u;
 if action='manual' then
  starts:=(payload->>'started_at')::timestamptz;minutes:=(payload->>'minutes')::integer;
  if starts>now() or starts<now()-interval '90 days' or minutes not between 1 and 240 then raise exception 'INVALID_SESSION';end if;
  if exists(select 1 from classstreak.sessions where user_id=u and source='manual' and week_key=classstreak.monday(starts,z)) then raise exception 'MANUAL_LIMIT';end if;
  select * into p from classstreak.places where id=(payload->>'place_id')::uuid and user_id=u;
  if not found then raise exception 'PLACE_REQUIRED';end if;
  select a.label into label from classstreak.activities a where key=payload->>'activity_key';if label is null then raise exception 'INVALID_ACTIVITY';end if;
  perform classstreak.ensure_week(u,starts);
  insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,week_key,day_key)
   values(u,p.id,p.venue_id,payload->>'activity_key',label,starts,starts+make_interval(mins=>minutes),minutes*60,'manual',classstreak.monday(starts,z),(starts at time zone z)::date);
 else
  select * into s from classstreak.sessions where id=(payload->>'id')::uuid and user_id=u and removed_at is null for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if action='remove' then
   if now()>s.created_at+interval '24 hours' then raise exception 'TOO_LATE';end if;
   update classstreak.sessions set removed_at=now() where id=s.id;
   if s.place_id is not null then insert into classstreak.suppressions values(u,s.place_id,extract(isodow from s.started_at at time zone z)::integer-1,extract(hour from s.started_at at time zone z)::integer,now()+interval '90 days')
    on conflict(user_id,place_id,weekday,hour) do update set expires_at=excluded.expires_at;end if;
  elsif action='edit' then
   if now()>s.created_at+interval '7 days' then raise exception 'TOO_LATE';end if;
   label:=trim(payload->>'workout_label');if length(label) not between 1 and 40 then raise exception 'INVALID_LABEL';end if;
   update classstreak.sessions set workout_label=label where id=s.id;
   update classstreak.places set last_workout_label=label where id=s.place_id and user_id=u;
   if payload->>'minutes' is not null and s.estimated then
    minutes:=(payload->>'minutes')::integer;if minutes not between 1 and 240 then raise exception 'INVALID_DURATION';end if;
    update classstreak.sessions set duration_sec=minutes*60,ended_at=started_at+make_interval(mins=>minutes),estimated=false where id=s.id;
   end if;
  else raise exception 'UNKNOWN_ACTION';end if;
 end if;
 perform classstreak.recount(u);return public.cs_snapshot();
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_tracking(text,uuid,uuid),public.cs_ingest(jsonb,uuid),public.cs_session(text,jsonb) from public,anon;
grant execute on function public.cs_tracking(text,uuid,uuid),public.cs_ingest(jsonb,uuid),public.cs_session(text,jsonb) to authenticated;
