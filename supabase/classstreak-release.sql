BEGIN;
-- Additive transition: legacy Turf tables and Auth identities remain intact.
create schema if not exists classstreak;
revoke all on schema classstreak from public, anon, authenticated;

create table classstreak.users (
 id uuid primary key default gen_random_uuid(), auth_id uuid unique references auth.users(id) on delete cascade,
 first_name text not null check(length(first_name) between 1 and 40), last_name text not null default '' check(length(last_name)<=60),
 gender text check(gender in ('Woman','Man','Non-binary','Prefer not to say')), tz text not null default 'America/Los_Angeles',
 theme text not null default 'blush' check(theme in ('blush','sage','clay')),
 share_place_name boolean not null default true, show_on_board boolean not null default true,
 share_simulated boolean not null default false, health_verify boolean not null default false,
 tracking_consent boolean not null default false, invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 phone_hash text, is_demo boolean not null default false, demo_owner uuid references classstreak.users(id) on delete cascade,
 notification_preferences jsonb not null default '{"usual":true,"logged":true,"risk":true,"recap":true,"milestone":true,"nudge":true,"reaction":true,"comment":true,"friend_request":true}',
 created_at timestamptz not null default now(), check((auth_id is not null and not is_demo) or (is_demo and demo_owner is not null))
);
create table classstreak.activities (
 key text primary key, label text not null, min_minutes integer not null, default_goal integer not null
);
insert into classstreak.activities values
 ('reformer','Reformer Pilates',35,2),('mat','Mat Pilates',35,2),('hot','Hot Pilates',35,2),
 ('yoga','Yoga',35,1),('cycling','Cycling',30,2),('barre','Barre',35,2),('hiit','HIIT',30,2),
 ('boxing','Boxing',30,2),('gym','Gym / weights',25,3);
create table classstreak.user_activities (
 user_id uuid references classstreak.users on delete cascade, activity_key text references classstreak.activities,
 goal integer not null check(goal between 0 and 4), primary key(user_id,activity_key)
);
create table classstreak.week_goals (
 user_id uuid references classstreak.users on delete cascade, week_key date not null, goal integer not null check(goal>=0),
 goals jsonb not null, tz text not null, primary key(user_id,week_key)
);
create table classstreak.usual_days (
 user_id uuid references classstreak.users on delete cascade, weekday integer check(weekday between 0 and 6),
 time_of_day text not null check(time_of_day in ('morning','midday','evening')), primary key(user_id,weekday)
);
create table classstreak.venues (
 id uuid primary key default gen_random_uuid(), google_place_id text unique, name text not null,
 lat double precision not null check(lat between -90 and 90), lng double precision not null check(lng between -180 and 180)
);
create table classstreak.places (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references classstreak.users on delete cascade,
 venue_id uuid not null references classstreak.venues, name text not null check(length(name) between 1 and 120), google_place_id text,
 activity_key text not null references classstreak.activities, lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180), radius_m integer not null check(radius_m in (75,100,150,250,400)),
 enabled boolean not null default true, share_name boolean not null default true, last_workout_label text,
 revision integer not null default 1, created_at timestamptz not null default now()
);
create index on classstreak.places(user_id);
create table classstreak.sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references classstreak.users on delete cascade,
 place_id uuid references classstreak.places on delete set null, venue_id uuid references classstreak.venues,
 activity_key text not null references classstreak.activities, workout_label text not null,
 started_at timestamptz not null, ended_at timestamptz not null, duration_sec integer not null check(duration_sec between 0 and 86400),
 source text not null check(source in ('geofence','manual','seed','simulated')), verified boolean not null default false,
 health_workout_id text, counted boolean not null default false, estimated boolean not null default false,
 week_key date not null, day_key date not null, photo_url text, note text check(length(note)<=240), removed_at timestamptz,
 event_key text, created_at timestamptz not null default now(), check(ended_at>=started_at), unique(user_id,event_key)
);
create index on classstreak.sessions(user_id,week_key);
create table classstreak.suppressions (
 user_id uuid references classstreak.users on delete cascade, place_id uuid references classstreak.places on delete cascade,
 weekday integer, hour integer, expires_at timestamptz not null, primary key(user_id,place_id,weekday,hour)
);
create table classstreak.friendships (
 user_a uuid references classstreak.users on delete cascade, user_b uuid references classstreak.users on delete cascade,
 status text not null check(status in ('pending','accepted')), requested_by uuid references classstreak.users on delete cascade,
 accepted_at timestamptz, created_at timestamptz not null default now(), primary key(user_a,user_b), check(user_a<user_b)
);
create table classstreak.reactions (
 session_id uuid references classstreak.sessions on delete cascade, user_id uuid references classstreak.users on delete cascade,
 emoji text not null check(emoji in ('🔥','👏','💀','🫡')), created_at timestamptz not null default now(), primary key(session_id,user_id)
);
create table classstreak.comments (
 id uuid primary key default gen_random_uuid(), session_id uuid references classstreak.sessions on delete cascade,
 user_id uuid references classstreak.users on delete cascade, body text not null check(length(body) between 1 and 240),
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table classstreak.inbox (
 id uuid primary key default gen_random_uuid(), user_id uuid references classstreak.users on delete cascade,
 kind text not null, from_user uuid references classstreak.users on delete cascade,
 session_id uuid references classstreak.sessions on delete cascade, body text not null, read_at timestamptz,
 created_at timestamptz not null default now()
);
create table classstreak.nudges (
 id uuid primary key default gen_random_uuid(), from_user uuid references classstreak.users on delete cascade,
 to_user uuid references classstreak.users on delete cascade, sent_on date not null, unique(from_user,to_user,sent_on)
);
create table classstreak.streaks (user_id uuid primary key references classstreak.users on delete cascade, current integer not null default 0,best integer not null default 0,last_week_key date,freezes_used_month integer not null default 0);
create table classstreak.milestones (user_id uuid references classstreak.users on delete cascade,count integer not null,earned_at timestamptz not null default now(),primary key(user_id,count));
create table classstreak.subscriptions (user_id uuid primary key references classstreak.users on delete cascade,product text,status text,renews_at timestamptz);
create table classstreak.reports (id uuid primary key default gen_random_uuid(), user_id uuid references classstreak.users on delete cascade,comment_id uuid references classstreak.comments on delete cascade,reason text not null check(length(reason)<=240),created_at timestamptz default now());

-- Defense in depth: no app role receives direct grants on these tables.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='classstreak' loop
  execute format('alter table classstreak.%I enable row level security',r.tablename);
 end loop;
end $$;

create function classstreak.me() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid; begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select id into u from classstreak.users where auth_id=auth.uid() and not is_demo;
 if u is null then raise exception 'SETUP_REQUIRED'; end if;
 return u;
end $$;
create function classstreak.monday(at_time timestamptz, zone text) returns date language sql immutable as $$
 select date_trunc('week',at_time at time zone zone)::date
$$;
create function classstreak.ensure_week(u uuid, at_time timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
declare z text; w date; g jsonb; n integer; begin
 select tz into z from classstreak.users where id=u;
 w:=classstreak.monday(at_time,z);
 select goals,goal,tz into g,n,z from classstreak.week_goals where user_id=u and week_key<=w order by week_key desc limit 1;
 if g is null then
  select coalesce(jsonb_agg(jsonb_build_object('activity_key',activity_key,'goal',goal)),'[]'),coalesce(sum(goal),0) into g,n from classstreak.user_activities where user_id=u;
  select tz into z from classstreak.users where id=u;
 end if;
 insert into classstreak.week_goals values(u,w,n,g,z) on conflict do nothing;
end $$;
create function classstreak.save_place(u uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid; result uuid; label text:=trim(p->>'name'); latitude double precision:=(p->>'lat')::double precision; longitude double precision:=(p->>'lng')::double precision; gid text:=nullif(p->>'google_place_id',''); begin
 perform 1 from classstreak.users where id=u for update;
 if not exists(select 1 from classstreak.activities where key=p->>'activity_key') then raise exception 'INVALID_ACTIVITY'; end if;
 if label is null or length(label) not between 1 and 120 or latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'INVALID_PLACE'; end if;
 if nullif(p->>'id','') is not null then select id into result from classstreak.places where id=(p->>'id')::uuid and user_id=u; end if;
 if result is null and (select count(*) from classstreak.places where user_id=u and enabled)>=12 then raise exception 'PLACE_LIMIT'; end if;
 if gid is not null then select id into v from classstreak.venues where google_place_id=gid;
 else select id into v from classstreak.venues where lower(name)=lower(label) and sqrt(power((lat-latitude)*111320,2)+power((lng-longitude)*111320*cos(radians(latitude)),2))<=150 limit 1; end if;
 if v is null then insert into classstreak.venues(google_place_id,name,lat,lng) values(gid,label,latitude,longitude) on conflict(google_place_id) do update set google_place_id=excluded.google_place_id returning id into v; end if;
 if result is null then
  insert into classstreak.places(user_id,venue_id,name,google_place_id,activity_key,lat,lng,radius_m,share_name)
  values(u,v,label,gid,p->>'activity_key',latitude,longitude,(p->>'radius_m')::integer,coalesce((p->>'share_name')::boolean,true)) returning id into result;
 else
  update classstreak.places set venue_id=v,name=label,google_place_id=gid,activity_key=p->>'activity_key',lat=latitude,lng=longitude,
   radius_m=(p->>'radius_m')::integer,enabled=coalesce((p->>'enabled')::boolean,true),share_name=coalesce((p->>'share_name')::boolean,true),revision=revision+1 where id=result;
 end if;
 return result;
end $$;
create function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); result jsonb; begin
 perform classstreak.ensure_week(u);
 select jsonb_build_object(
 'profile',to_jsonb(p)-'auth_id'-'phone_hash'-'demo_owner'||jsonb_build_object('phone_set',p.phone_hash is not null),
 'goals',coalesce((select goals from classstreak.week_goals where user_id=u and week_key=classstreak.monday(now(),p.tz)),'[]'),
 'pending_goals',coalesce((select goals from classstreak.week_goals where user_id=u and week_key>classstreak.monday(now(),p.tz) order by week_key limit 1),'[]'),
 'usual_days',coalesce((select jsonb_agg(jsonb_build_object('weekday',weekday,'time_of_day',time_of_day) order by weekday) from classstreak.usual_days where user_id=u),'[]'),
 'places',coalesce((select jsonb_agg(to_jsonb(x) order by created_at) from classstreak.places x where user_id=u),'[]'),
 'sessions',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('place_name',q.name) order by x.started_at desc) from classstreak.sessions x left join classstreak.places q on q.id=x.place_id where x.user_id=u),'[]'),
 'weeks',coalesce((select jsonb_agg(to_jsonb(w) order by week_key) from classstreak.week_goals w where user_id=u),'[]'),
 'friends','[]'::jsonb,'feed','[]'::jsonb,
 'inbox',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from classstreak.inbox x where user_id=u),'[]'),
 'server_time',now()) into result from classstreak.users p where id=u;
 return result;
end $$;
create function public.cs_bootstrap(draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; g record; day jsonb; z text:=coalesce(draft->>'tz','America/Los_Angeles'); begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from pg_timezone_names where name=z) then raise exception 'INVALID_TIMEZONE'; end if;
 select id into u from classstreak.users where auth_id=auth.uid();
 if u is not null then return public.cs_snapshot(); end if;
 insert into classstreak.users(auth_id,first_name,last_name,gender,tz,theme,tracking_consent)
 values(auth.uid(),trim(draft->>'first_name'),coalesce(trim(draft->>'last_name'),''),nullif(draft->>'gender',''),z,coalesce(draft->>'theme','blush'),coalesce((draft->>'location_consent')::boolean,false)) returning id into u;
 if jsonb_array_length(coalesce(draft->'selected','[]'))=0 then raise exception 'SELECT_ACTIVITY'; end if;
 for g in select value as key from jsonb_array_elements_text(draft->'selected') loop
  insert into classstreak.user_activities values(u,g.key,coalesce((draft->'goals'->>g.key)::integer,0));
 end loop;
 for day in select * from jsonb_array_elements(coalesce(draft->'days','[]')) loop
  insert into classstreak.usual_days values(u,day::integer,coalesce(draft->>'time','evening')) on conflict do nothing;
 end loop;
 if draft->'place' is not null and draft->'place'<>'null' then perform classstreak.save_place(u,draft->'place'); end if;
 perform classstreak.ensure_week(u);
 return public.cs_snapshot();
end $$;
create function public.cs_settings(kind text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); g record; d jsonb; z text; next_week date; goals_json jsonb; begin
 perform 1 from classstreak.users where id=u for update;
 if kind='profile' then
  update classstreak.users set first_name=coalesce(nullif(trim(payload->>'first_name'),''),first_name),
   last_name=coalesce(payload->>'last_name',last_name),theme=coalesce(payload->>'theme',theme),
   share_place_name=coalesce((payload->>'share_place_name')::boolean,share_place_name),
   show_on_board=coalesce((payload->>'show_on_board')::boolean,show_on_board),
   share_simulated=coalesce((payload->>'share_simulated')::boolean,share_simulated),
   health_verify=coalesce((payload->>'health_verify')::boolean,health_verify),
   tracking_consent=coalesce((payload->>'tracking_consent')::boolean,tracking_consent),
   notification_preferences=notification_preferences||coalesce(payload->'notification_preferences','{}'::jsonb) where id=u;
 elsif kind='goals' then
  select tz into z from classstreak.users where id=u; next_week:=classstreak.monday(now(),z)+7;
  delete from classstreak.user_activities where user_id=u;
  for g in select * from jsonb_to_recordset(payload->'goals') as x(activity_key text, goal integer) loop
   insert into classstreak.user_activities values(u,g.activity_key,g.goal);
  end loop;
  select jsonb_agg(jsonb_build_object('activity_key',activity_key,'goal',goal)) into goals_json from classstreak.user_activities where user_id=u;
  if goals_json is null then raise exception 'SELECT_ACTIVITY'; end if;
  insert into classstreak.week_goals values(u,next_week,(select sum(goal) from classstreak.user_activities where user_id=u),goals_json,z)
  on conflict(user_id,week_key) do update set goal=excluded.goal,goals=excluded.goals;
 elsif kind='days' then
  delete from classstreak.usual_days where user_id=u;
  for d in select * from jsonb_array_elements(payload->'days') loop
   insert into classstreak.usual_days values(u,d::integer,payload->>'time') on conflict do nothing;
  end loop;
 elsif kind='place' then perform classstreak.save_place(u,payload);
 elsif kind='disable_place' then update classstreak.places set enabled=false where id=(payload->>'id')::uuid and user_id=u;
 elsif kind='inbox_read' then update classstreak.inbox set read_at=now() where user_id=u and (payload->>'id' is null or id=(payload->>'id')::uuid);
 elsif kind='timezone' then
  z:=payload->>'tz'; if not exists(select 1 from pg_timezone_names where name=z) then raise exception 'INVALID_TIMEZONE'; end if;
  select classstreak.monday(now(),tz)+7 into next_week from classstreak.users where id=u;
  insert into classstreak.week_goals select u,next_week,goal,goals,z from classstreak.week_goals where user_id=u and week_key<=next_week order by week_key desc limit 1
   on conflict(user_id,week_key) do update set tz=excluded.tz;
 else raise exception 'UNKNOWN_ACTION';
 end if;
 return public.cs_snapshot();
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_snapshot(),public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb) from public,anon;
grant execute on function public.cs_snapshot(),public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb) to authenticated;

create table classstreak.tracking_devices (
 user_id uuid primary key references classstreak.users on delete cascade, installation_id uuid not null, token uuid not null default gen_random_uuid(),
 active boolean not null default true, started_at timestamptz not null default now(), last_seen timestamptz not null default now(), stopped_at timestamptz
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
 update classstreak.sessions s set counted=(s.removed_at is null and s.id=(select x.id from classstreak.sessions x join classstreak.activities a on a.key=x.activity_key where x.user_id=u and x.activity_key=s.activity_key and x.day_key=s.day_key and x.removed_at is null and (x.source='manual' or x.duration_sec>=a.min_minutes*60) order by x.started_at,x.id limit 1)) where s.user_id=u;
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
create function public.cs_tracking(action text, installation uuid default null, capture_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); device classstreak.tracking_devices; begin
 perform 1 from classstreak.users where id=u for update;
 if action='start' then
  if not (select tracking_consent from classstreak.users where id=u) then raise exception 'CONSENT_REQUIRED';end if;
  if installation is null or not exists(select 1 from classstreak.places where user_id=u and enabled) then raise exception 'PLACE_REQUIRED';end if;
  insert into classstreak.tracking_devices(user_id,installation_id) values(u,installation)
   on conflict(user_id) do update set installation_id=excluded.installation_id,token=gen_random_uuid(),active=true,started_at=now(),last_seen=now(),stopped_at=null
   returning * into device;
  delete from classstreak.visit_candidates where user_id=u and source='geofence';
  delete from classstreak.region_state where user_id=u;
 elsif action='stop' then
  update classstreak.tracking_devices set active=false,stopped_at=coalesce(stopped_at,now()) where user_id=u and token=capture_token;
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

-- Weekly targets are immutable snapshots; a pending zone applies at the old zone's Monday.
create table classstreak.timezone_changes(user_id uuid primary key references classstreak.users on delete cascade,tz text not null,effective_at timestamptz not null);
alter table classstreak.timezone_changes enable row level security;
alter function public.cs_settings(text,jsonb) rename to cs_settings_base;
revoke all on function public.cs_settings_base(text,jsonb) from public,anon,authenticated;
create function public.cs_settings(kind text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();z text;begin
 if kind='timezone' then
  if not exists(select 1 from pg_timezone_names where name=payload->>'tz') then raise exception 'INVALID_TIMEZONE';end if;
  select tz into z from classstreak.users where id=u;
  insert into classstreak.timezone_changes values(u,payload->>'tz',(classstreak.monday(now(),z)+7)::timestamp at time zone z) on conflict(user_id) do update set tz=excluded.tz,effective_at=excluded.effective_at;
 end if;
 return public.cs_settings_base(kind,payload);
end $$;
revoke all on function public.cs_settings(text,jsonb) from public,anon;
grant execute on function public.cs_settings(text,jsonb) to authenticated;
create or replace function classstreak.ensure_week(u uuid, at_time timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
declare z text; w date; g jsonb; n integer; pending record; begin
 select tz into z from classstreak.users where id=u;
 select * into pending from classstreak.timezone_changes where user_id=u and effective_at<=now();
 if pending.tz is not null then update classstreak.users set tz=pending.tz where id=u; z:=pending.tz;delete from classstreak.timezone_changes where user_id=u; end if;
 w:=classstreak.monday(at_time,z);
 select goals,goal into g,n from classstreak.week_goals where user_id=u and week_key<=w order by week_key desc limit 1;
 if g is null then select coalesce(jsonb_agg(jsonb_build_object('activity_key',activity_key,'goal',goal)),'[]'),coalesce(sum(goal),0) into g,n from classstreak.user_activities where user_id=u; end if;
 insert into classstreak.week_goals values(u,w,n,g,z) on conflict do nothing;
end $$;
create function classstreak.progress(u uuid,as_of timestamptz default now()) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare z text; w date; first_week date; cursor_week date; target integer; total integer; current_count integer; current_goal integer; streak integer:=0; best integer:=0; lifetime integer; history jsonb:='[]'; begin
 select tz into z from classstreak.users where id=u; w:=classstreak.monday(as_of,z);
 select count(*) into lifetime from classstreak.sessions where user_id=u and counted and removed_at is null and started_at<=as_of;
 select greatest(coalesce(min(week_key),w),w-3640) into first_week from classstreak.sessions where user_id=u and removed_at is null;
 cursor_week:=least(first_week,w-77);
 while cursor_week<=w loop
  select goal into target from classstreak.week_goals where user_id=u and week_key<=cursor_week order by week_key desc limit 1;
  target:=coalesce(target,(select sum(goal) from classstreak.user_activities where user_id=u),0);
  select count(*) into total from classstreak.sessions where user_id=u and counted and removed_at is null and week_key=cursor_week and started_at<=as_of;
  if target>0 and total>=target then streak:=streak+1; best:=greatest(best,streak); elsif cursor_week<w then streak:=0; end if;
  if cursor_week>=w-77 then history:=history||jsonb_build_array(jsonb_build_object('week',cursor_week,'count',total,'goal',target,'hit',target>0 and total>=target)); end if;
  if cursor_week=w then current_count:=total;current_goal:=target;end if;
  cursor_week:=cursor_week+7;
 end loop;
 return jsonb_build_object('week',w,'count',current_count,'goal',current_goal,'streak',streak,'best',best,'lifetime',lifetime,'history',history);
end $$;
create function classstreak.rollup_one(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare result jsonb; milestone integer; begin
 perform classstreak.ensure_week(u); perform classstreak.recount(u); result:=classstreak.progress(u);
 insert into classstreak.streaks(user_id,current,best,last_week_key) values(u,(result->>'streak')::integer,(result->>'best')::integer,(result->>'week')::date)
 on conflict(user_id) do update set current=excluded.current,best=excluded.best,last_week_key=excluded.last_week_key;
 delete from classstreak.milestones where user_id=u and count>(result->>'lifetime')::integer;
 foreach milestone in array array[1,10,25,50,100,250] loop
  if (result->>'lifetime')::integer>=milestone then insert into classstreak.milestones(user_id,count) values(u,milestone) on conflict do nothing; end if;
 end loop;
end $$;
create function public.cs_rollup(as_of timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); begin
 if as_of is not null and abs(extract(epoch from(as_of-now())))>370*86400 then raise exception 'INVALID_CLOCK';end if;
 -- Debug time never changes another user's state, real candidates or persistent production rollups.
 if as_of is null then perform classstreak.rollup_one(u);end if;
 return classstreak.progress(u,coalesce(as_of,now()));
end $$;
create function public.cs_seed_demo(remove_demo boolean default false, demo_places jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me(); z text; w date; f uuid; name text; target integer; i integer; j integer; n integer; stamp timestamptz; p uuid; peer_place uuid; v uuid; place jsonb; goal_json jsonb; begin
 perform 1 from classstreak.users where id=u for update;
 delete from classstreak.users where demo_owner=u;
 delete from classstreak.sessions where user_id=u and source='seed';
 if remove_demo then perform classstreak.rollup_one(u); return public.cs_snapshot();end if;
 select tz into z from classstreak.users where id=u;w:=classstreak.monday(now(),z);
 -- Named demo pins must be real Places results; no placeholder is ever registered.
 if jsonb_array_length(demo_places)>2 then raise exception 'INVALID_PLACES';end if;
 for place in select * from jsonb_array_elements(demo_places) loop
  if nullif(place->>'google_place_id','') is not null and not exists(select 1 from classstreak.places where user_id=u and google_place_id=place->>'google_place_id') and (select count(*) from classstreak.places where user_id=u and enabled)<12 then perform classstreak.save_place(u,place);end if;
 end loop;
 select id,venue_id into p,v from classstreak.places where user_id=u and enabled order by created_at limit 1;
 -- Keep actual history intact. Explicit demo history uses separate event keys and is removable.
 for i in -8..0 loop
  n:=case when i=-8 then 3 when i=-7 then 0 when i=0 then 1 else 3 end;
  insert into classstreak.week_goals values(u,w+i*7,3,'[{"activity_key":"reformer","goal":2},{"activity_key":"yoga","goal":1}]',z) on conflict do nothing;
  for j in 1..n loop
   stamp:=((w+i*7+j-1)::timestamp+interval '8 hours') at time zone z;
   if i=0 then stamp:=least(stamp,now()-interval '1 hour');end if;
   insert into classstreak.sessions(user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,week_key,day_key,event_key)
   values(u,p,v,case when j=3 then 'yoga' else 'reformer' end,case when j=3 then 'Yoga' else 'Reformer Pilates' end,stamp,stamp+interval '52 minutes',3120,'seed',w+i*7,(stamp at time zone z)::date,'seed:owner:'||i||':'||j);
  end loop;
 end loop;
 foreach name in array array['Priya','Jess','Maya'] loop
  target:=case name when 'Priya' then 3 when 'Jess' then 4 else 2 end;
  insert into classstreak.users(first_name,last_name,tz,is_demo,demo_owner) values(name,case name when 'Priya' then 'S' when 'Jess' then 'M' else 'K' end,z,true,u) returning id into f;
  insert into classstreak.user_activities values(f,'reformer',target);
  insert into classstreak.friendships(user_a,user_b,status,requested_by,accepted_at) values(least(u,f),greatest(u,f),'accepted',u,(w-56)::timestamp at time zone z);
  insert into classstreak.usual_days select f,d,'evening' from unnest(case name when 'Priya' then array[0,2,4] when 'Jess' then array[1,3] else array[1] end) d;
  for i in -7..0 loop
   goal_json:=jsonb_build_array(jsonb_build_object('activity_key','reformer','goal',target));
   insert into classstreak.week_goals values(f,w+i*7,target,goal_json,z);
   n:=case when i=0 then case when name='Maya' then 1 else 3 end else target end;
   for j in 1..n loop
    stamp:=((w+i*7+j-1)::timestamp+interval '8 hours') at time zone z;
    -- Future demo entries stay labeled; fixture totals intentionally describe the whole sample week.
    insert into classstreak.sessions(user_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,week_key,day_key,event_key)
    values(f,v,'reformer','Reformer Pilates',stamp,stamp+interval '52 minutes',3120,'seed',w+i*7,(stamp at time zone z)::date,'seed:'||i||':'||j);
   end loop;
  end loop;
  perform classstreak.rollup_one(f);
 end loop;
 insert into classstreak.comments(session_id,user_id,body) select s.id,jess.id,'Killed it, see you Thursday' from classstreak.sessions s join classstreak.users priya on priya.id=s.user_id join classstreak.users jess on jess.demo_owner=u and jess.first_name='Jess' where priya.demo_owner=u and priya.first_name='Priya' order by s.started_at desc limit 1;
 insert into classstreak.reactions(session_id,user_id,emoji) select s.id,jess.id,'👏' from classstreak.sessions s join classstreak.users priya on priya.id=s.user_id join classstreak.users jess on jess.demo_owner=u and jess.first_name='Jess' where priya.demo_owner=u and priya.first_name='Priya' order by s.started_at desc limit 1;
 perform classstreak.rollup_one(u);return public.cs_snapshot();
end $$;
-- Service-only scheduled job; no request parameter can nominate another owner.
create function classstreak.maintenance() returns void language plpgsql security definer set search_path='' as $$
declare r record; begin
 for r in select c.user_id,c.source,c.entered_at from classstreak.visit_candidates c join classstreak.tracking_devices d on d.user_id=c.user_id and d.token=c.token and d.active where c.source='geofence' and c.entered_at<=now()-interval '4 hours' loop perform classstreak.close_visit(r.user_id,r.entered_at+interval '4 hours',true,null,r.source);end loop;
 for r in select id from classstreak.users loop perform classstreak.rollup_one(r.id);end loop;
 delete from classstreak.suppressions where expires_at<now();
 delete from classstreak.processed_events where observed_at<now()-interval '30 days';
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_rollup(timestamptz),public.cs_seed_demo(boolean,jsonb) from public,anon;
grant execute on function public.cs_rollup(timestamptz),public.cs_seed_demo(boolean,jsonb) to authenticated;

create table classstreak.secrets(key text primary key,value bytea not null);
insert into classstreak.secrets values('phone',extensions.gen_random_bytes(32));
create table classstreak.rate_limits(user_id uuid references classstreak.users on delete cascade,kind text,bucket date,n integer not null,primary key(user_id,kind,bucket));
create table classstreak.ended_friendships(user_a uuid references classstreak.users on delete cascade,user_b uuid references classstreak.users on delete cascade,primary key(user_a,user_b));
alter table classstreak.ended_friendships enable row level security;
alter table classstreak.secrets enable row level security;
alter table classstreak.rate_limits enable row level security;
create function classstreak.throttle(u uuid,k text,maximum integer,amount integer default 1) returns void language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into classstreak.rate_limits values(u,k,current_date,amount) on conflict(user_id,kind,bucket) do update set n=classstreak.rate_limits.n+excluded.n returning rate_limits.n into n;
 if n>maximum then raise exception 'TRY_TOMORROW';end if;
end $$;
create function classstreak.friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from classstreak.friendships where user_a=least(a,b) and user_b=greatest(a,b) and status='accepted')
$$;
create function classstreak.can_see_session(viewer uuid,sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from classstreak.sessions s join classstreak.users u on u.id=s.user_id where s.id=sid and s.removed_at is null and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key)) and (
  s.user_id=viewer or (exists(select 1 from classstreak.friendships f where f.user_a=least(viewer,u.id) and f.user_b=greatest(viewer,u.id) and f.status='accepted' and s.day_key>=(f.accepted_at at time zone u.tz)::date)
  and (s.source in ('geofence','manual') or (u.is_demo and u.demo_owner=viewer) or u.share_simulated))
 ))
$$;
-- The invoker view exposes only a checked projection. It grants no read on raw tables.
create function public.cs_friend_feed() returns table(id uuid,user_id uuid,first_name text,activity_key text,workout_label text,duration_sec integer,place_name text,relative_time text,source text,photo_url text,note text,reactions jsonb,comments jsonb) language sql stable security definer set search_path='' as $$
 select s.id,s.user_id,u.first_name,s.activity_key,s.workout_label,s.duration_sec,
  case when u.share_place_name and coalesce(p.share_name,u.is_demo) then coalesce(p.name,case when u.is_demo then v.name end) end,
  case when (now() at time zone u.tz)::date-s.day_key<=0 then 'today' when (now() at time zone u.tz)::date-s.day_key=1 then 'yesterday' else ((now() at time zone u.tz)::date-s.day_key)::text||' days ago' end,
  s.source,s.photo_url,s.note,
  coalesce((select jsonb_agg(r) from (select emoji,count(*) as count,bool_or(user_id=classstreak.me()) as mine from classstreak.reactions where session_id=s.id group by emoji) r),'[]'),
  coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'user_id',c.user_id,'first_name',author.first_name,'body',c.body) order by c.created_at,c.id) from classstreak.comments c join classstreak.users author on author.id=c.user_id where c.session_id=s.id and c.deleted_at is null and (c.user_id=classstreak.me() or c.user_id=s.user_id or classstreak.friends(classstreak.me(),c.user_id))),'[]')
 from classstreak.sessions s join classstreak.users u on u.id=s.user_id left join classstreak.places p on p.id=s.place_id left join classstreak.venues v on v.id=s.venue_id
 where classstreak.can_see_session(classstreak.me(),s.id) and s.started_at>now()-interval '90 days'
 order by s.started_at desc,s.id limit 100
$$;
create view public.friend_feed with(security_invoker=true) as select * from public.cs_friend_feed();
revoke all on public.friend_feed from public,anon;
grant select on public.friend_feed to authenticated;
create function classstreak.shared_streak(viewer uuid,peer uuid) returns integer language plpgsql stable security definer set search_path='' as $$
declare w date;current_week date;z text;target integer;n integer;result integer:=0;i integer;sim boolean;begin
 select tz,share_simulated or (is_demo and demo_owner=viewer) into z,sim from classstreak.users where id=peer;current_week:=classstreak.monday(now(),z);w:=current_week;
 for i in 0..520 loop
  select goal into target from classstreak.week_goals where user_id=peer and week_key<=w order by week_key desc limit 1;
  if target is null then exit;end if;
  select count(distinct(day_key,activity_key)) into n from classstreak.sessions where user_id=peer and week_key=w and removed_at is null and (source='manual' or duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=activity_key)) and (source in('geofence','manual') or sim);
  if target>0 and n>=target then result:=result+1;elsif w<current_week then exit;end if;w:=w-7;
 end loop;return result;
end $$;
create function classstreak.friend_list(viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by item->>'first_name'),'[]') from (
 select jsonb_build_object('id',u.id,'first_name',u.first_name,'status',f.status,'requested_by',f.requested_by,'is_demo',u.is_demo,
  'weekly_count',case when f.status='accepted' then (select count(distinct(s.day_key,s.activity_key)) from classstreak.sessions s where s.user_id=u.id and s.week_key=classstreak.monday(now(),u.tz) and classstreak.can_see_session(viewer,s.id)) else 0 end,
  'weekly_goal',case when f.status='accepted' then coalesce((select goal from classstreak.week_goals where user_id=u.id and week_key<=classstreak.monday(now(),u.tz) order by week_key desc limit 1),0) else 0 end,
  'streak',case when f.status='accepted' then classstreak.shared_streak(viewer,u.id) else 0 end,
  'days',case when f.status='accepted' then coalesce((select jsonb_agg(distinct extract(isodow from s.day_key)::integer-1) from classstreak.sessions s where s.user_id=u.id and s.week_key=classstreak.monday(now(),u.tz) and classstreak.can_see_session(viewer,s.id)),'[]') else '[]'::jsonb end,
  'usual_days',case when f.status='accepted' then coalesce((select jsonb_agg(weekday order by weekday) from classstreak.usual_days where user_id=u.id),'[]') else '[]'::jsonb end,
  'time_of_day',case when f.status='accepted' then (select time_of_day from classstreak.usual_days where user_id=u.id order by weekday limit 1) end,
  'nudge_available',f.status='accepted' and exists(select 1 from classstreak.usual_days d where d.user_id=u.id and d.weekday=extract(isodow from now() at time zone u.tz)::integer-1 and extract(hour from now() at time zone u.tz)>=case d.time_of_day when 'morning' then 8 when 'midday' then 12 else 18 end)
    and extract(hour from now() at time zone u.tz)<22
    and not exists(select 1 from classstreak.sessions s where s.user_id=u.id and s.day_key=(now() at time zone u.tz)::date and classstreak.can_see_session(viewer,s.id))
    and not exists(select 1 from classstreak.nudges n where n.from_user=viewer and n.to_user=u.id and n.sent_on=(now() at time zone u.tz)::date)
 ) item from classstreak.friendships f join classstreak.users u on u.id=case when f.user_a=viewer then f.user_b else f.user_a end where viewer in(f.user_a,f.user_b)
 ) q
$$;
alter function public.cs_snapshot() rename to cs_snapshot_base;
revoke all on function public.cs_snapshot_base() from public,anon,authenticated;
create function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;begin
 result:=public.cs_snapshot_base();
 return result||jsonb_build_object('friends',classstreak.friend_list(u),'feed',coalesce((select jsonb_agg(to_jsonb(f)) from public.friend_feed f),'[]'));
end $$;
-- Realtime carries an own-account revision number only, never a raw session or friendship row.
create table public.cs_revisions(auth_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 1);
alter table public.cs_revisions enable row level security;
create policy cs_revision_self on public.cs_revisions for select to authenticated using(auth_id=auth.uid());
revoke all on public.cs_revisions from public,anon,authenticated;grant select on public.cs_revisions to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.cs_revisions;end if;end $$;
create function classstreak.touch(u uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.cs_revisions(auth_id) select auth_id from classstreak.users where auth_id is not null and (id=u or classstreak.friends(id,u)) on conflict(auth_id) do update set revision=cs_revisions.revision+1;
end $$;
create function classstreak.session_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform classstreak.touch(coalesce(new.user_id,old.user_id));return coalesce(new,old);end $$;
create trigger cs_session_revision after insert or update or delete on classstreak.sessions for each row execute function classstreak.session_changed();
create trigger cs_place_revision after update on classstreak.places for each row execute function classstreak.session_changed();
create function classstreak.user_changed() returns trigger language plpgsql security definer set search_path='' as $$begin perform classstreak.touch(new.id);return new;end $$;
create trigger cs_user_revision after update on classstreak.users for each row execute function classstreak.user_changed();
create function classstreak.inform(recipient uuid,k text,sender uuid,sid uuid,message text) returns void language plpgsql security definer set search_path='' as $$
begin
 if recipient=sender or (select is_demo or notification_preferences->>k='false' from classstreak.users where id=recipient) then return;end if;
 if k in('reaction','comment') then
  update classstreak.inbox set body=message,read_at=null where user_id=recipient and kind=k and session_id=sid and created_at>=date_trunc('hour',now());
  if found then perform classstreak.touch(recipient);return;end if;
 end if;
 insert into classstreak.inbox(user_id,kind,from_user,session_id,body) values(recipient,k,sender,sid,message);perform classstreak.touch(recipient);
end $$;
create function public.cs_social(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();peer uuid;sid uuid;target uuid;f classstreak.friendships;s classstreak.sessions;name text;comment_id uuid;day date;available boolean;begin
 perform 1 from classstreak.users where id=u for update;select first_name into name from classstreak.users where id=u;
 perform classstreak.throttle(u,'social',300);
 if action in('invite','request','accept','remove') then
  if action='invite' then
   perform classstreak.throttle(u,'invite',30);select id into peer from classstreak.users where invite_code=upper(trim(payload->>'code')) and not is_demo;
  else peer:=(payload->>'id')::uuid;end if;
  if peer is null or peer=u or not exists(select 1 from classstreak.users where id=peer and (not is_demo or demo_owner=u)) then raise exception 'INVITE_INVALID';end if;
  select * into f from classstreak.friendships where user_a=least(u,peer) and user_b=greatest(u,peer) for update;
  if action='remove' then
   insert into classstreak.ended_friendships values(least(u,peer),greatest(u,peer)) on conflict do nothing;
   delete from classstreak.friendships where user_a=least(u,peer) and user_b=greatest(u,peer);
   delete from classstreak.inbox where (user_id=u and from_user=peer) or (user_id=peer and from_user=u);
  elsif action='accept' then
   if f.status is distinct from 'pending' or f.requested_by=u then raise exception 'FORBIDDEN';end if;
   update classstreak.friendships set status='accepted',accepted_at=now() where user_a=least(u,peer) and user_b=greatest(u,peer);
  elsif action='invite' then
   if exists(select 1 from classstreak.ended_friendships where user_a=least(u,peer) and user_b=greatest(u,peer)) then
    insert into classstreak.friendships(user_a,user_b,status,requested_by) values(least(u,peer),greatest(u,peer),'pending',u) on conflict do nothing;
    perform classstreak.inform(peer,'friend_request',u,null,name||' wants to be friends again.');
   else
    insert into classstreak.friendships(user_a,user_b,status,requested_by,accepted_at) values(least(u,peer),greatest(u,peer),'accepted',u,now()) on conflict(user_a,user_b) do update set status='accepted',accepted_at=coalesce(friendships.accepted_at,now());
   end if;
  elsif f.status is null then
   perform classstreak.throttle(u,'request',20);
   insert into classstreak.friendships(user_a,user_b,status,requested_by) values(least(u,peer),greatest(u,peer),'pending',u);
   perform classstreak.inform(peer,'friend_request',u,null,name||' wants to be friends.');
  end if;
  perform classstreak.touch(peer);
 elsif action='nudge' then
  peer:=(payload->>'id')::uuid;
  select (x->>'nudge_available')::boolean into available from jsonb_array_elements(classstreak.friend_list(u)) x where x->>'id'=peer::text;
  if not coalesce(available,false) then raise exception 'NUDGE_UNAVAILABLE';end if;
  select (now() at time zone tz)::date into day from classstreak.users where id=peer;
  insert into classstreak.nudges(from_user,to_user,sent_on) values(u,peer,day) on conflict do nothing;
  if found then perform classstreak.inform(peer,'nudge',u,null,name||' nudged you. There is still time today.');end if;
 elsif action in('reaction','comment') then
  sid:=(payload->>'session_id')::uuid;if not classstreak.can_see_session(u,sid) then raise exception 'FORBIDDEN';end if;
  select * into s from classstreak.sessions where id=sid;
  if action='reaction' then
   if exists(select 1 from classstreak.reactions where session_id=sid and user_id=u and emoji=payload->>'emoji') then delete from classstreak.reactions where session_id=sid and user_id=u;
   else insert into classstreak.reactions values(sid,u,payload->>'emoji',now()) on conflict(session_id,user_id) do update set emoji=excluded.emoji;perform classstreak.inform(s.user_id,'reaction',u,sid,'New reactions on your session.');end if;
  else
   insert into classstreak.comments(session_id,user_id,body) values(sid,u,trim(payload->>'body'));
   perform classstreak.inform(s.user_id,'comment',u,sid,name||' commented on your session.');
  end if;
  perform classstreak.touch(s.user_id);
 elsif action in('delete_comment','report') then
  comment_id:=(payload->>'id')::uuid;select session_id,user_id into sid,target from classstreak.comments where id=comment_id and deleted_at is null;
  if sid is null or not classstreak.can_see_session(u,sid) then raise exception 'FORBIDDEN';end if;
  if action='delete_comment' then
   if target<>u then raise exception 'FORBIDDEN';end if;update classstreak.comments set deleted_at=now() where id=comment_id;
  else insert into classstreak.reports(user_id,comment_id,reason) values(u,comment_id,left(coalesce(payload->>'reason','Reported in app'),240));end if;
  perform classstreak.touch((select user_id from classstreak.sessions where id=sid));
 else raise exception 'UNKNOWN_ACTION';end if;
 perform classstreak.touch(u);return public.cs_snapshot();
end $$;
create function classstreak.phone_hash(phone text) returns text language plpgsql stable security definer set search_path='' as $$
declare normalized text:=regexp_replace(phone,'[^0-9+]','','g');begin
 if normalized !~ '^\+[1-9][0-9]{7,14}$' then return null;end if;
 return encode(extensions.hmac(convert_to(normalized,'UTF8'),(select value from classstreak.secrets where key='phone'),'sha256'),'hex');
end $$;
create function public.cs_contacts(action text,phones jsonb default '[]',phone text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();h text;result jsonb;begin
 perform 1 from classstreak.users where id=u for update;
 if action='save' then
  perform classstreak.throttle(u,'phone',5);h:=classstreak.phone_hash(phone);
  if nullif(trim(phone),'') is not null and h is null then raise exception 'PHONE_COUNTRY_CODE';end if;
  update classstreak.users set phone_hash=h where id=u;return jsonb_build_object('saved',h is not null);
 elsif action='match' then
  if (select phone_hash from classstreak.users where id=u) is null then raise exception 'ADD_PHONE';end if;
  if jsonb_typeof(phones)<>'array' or jsonb_array_length(phones)>500 then raise exception 'CONTACT_LIMIT';end if;
  perform classstreak.throttle(u,'contact_match',500,jsonb_array_length(phones));
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'first_name',first_name)),'[]') into result from classstreak.users where id<>u and not is_demo and phone_hash in(select classstreak.phone_hash(value) from jsonb_array_elements_text(phones));
  return result;
 else raise exception 'UNKNOWN_ACTION';end if;
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_snapshot(),public.cs_friend_feed(),public.cs_social(text,jsonb),public.cs_contacts(text,jsonb,text) from public,anon;
grant execute on function public.cs_snapshot(),public.cs_friend_feed(),public.cs_social(text,jsonb),public.cs_contacts(text,jsonb,text) to authenticated;

create function public.cs_can_write_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(path,'/',1)=auth.uid()::text and path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
 and exists(select 1 from classstreak.sessions s where s.id::text=split_part(path,'/',2) and s.user_id=classstreak.me() and s.removed_at is null)
$$;
create function public.cs_can_read_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from classstreak.sessions s join classstreak.users u on u.id=s.user_id where s.id::text=split_part(path,'/',2) and u.auth_id::text=split_part(path,'/',1) and (s.photo_url=path or s.user_id=classstreak.me()) and classstreak.can_see_session(classstreak.me(),s.id))
$$;
-- Storage exists on hosted Supabase. Tests also apply these policies to its contract fixture.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('classstreak-photos','classstreak-photos',false,10485760,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  create policy cs_photos_read on storage.objects for select to authenticated using(bucket_id='classstreak-photos' and public.cs_can_read_photo(name));
  create policy cs_photos_insert on storage.objects for insert to authenticated with check(bucket_id='classstreak-photos' and public.cs_can_write_photo(name));
  create policy cs_photos_update on storage.objects for update to authenticated using(bucket_id='classstreak-photos' and public.cs_can_write_photo(name)) with check(bucket_id='classstreak-photos' and public.cs_can_write_photo(name));
  create policy cs_photos_delete on storage.objects for delete to authenticated using(bucket_id='classstreak-photos' and split_part(name,'/',1)=auth.uid()::text);
 end if;
end $$;
create function public.cs_attach_photo(session_id uuid,path text,note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();uploaded boolean;begin
 if not public.cs_can_write_photo(path) or split_part(path,'/',2)<>session_id::text then raise exception 'FORBIDDEN';end if;
 if to_regclass('storage.objects') is null then raise exception 'STORAGE_NOT_READY';end if;
 execute 'select exists(select 1 from storage.objects where bucket_id=''classstreak-photos'' and name=$1)' into uploaded using path;
 if not uploaded then raise exception 'PHOTO_NOT_UPLOADED';end if;
 update classstreak.sessions set photo_url=path,note=cs_attach_photo.note where id=session_id and user_id=u and removed_at is null;
 return public.cs_snapshot();
end $$;
revoke all on function public.cs_can_read_photo(text),public.cs_can_write_photo(text),public.cs_attach_photo(uuid,text,text) from public,anon;
grant execute on function public.cs_can_read_photo(text),public.cs_can_write_photo(text),public.cs_attach_photo(uuid,text,text) to authenticated;

create table classstreak.studio_links(id uuid primary key default gen_random_uuid(),venue_id uuid not null references classstreak.venues,created_by uuid references classstreak.users on delete cascade,activity_key text references classstreak.activities,radius_m integer not null,created_at timestamptz not null default now());
alter table classstreak.studio_links enable row level security;
create function public.cs_venue_board() returns table(venue_id uuid,row_id text,name text,weekly_count bigint,is_me boolean) language sql stable security definer set search_path='' as $$
 with real_sessions as(select s.*,row_number() over(partition by user_id,day_key,activity_key order by started_at,id) as ordinal from classstreak.sessions s where s.removed_at is null and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key)) and s.source in('geofence','manual'))
 select s.venue_id,md5(s.venue_id::text||u.id::text),u.first_name||case when u.last_name='' then '' else ' '||left(u.last_name,1)||'.' end,count(*),u.id=classstreak.me()
 from real_sessions s join classstreak.users u on u.id=s.user_id where s.ordinal=1 and u.show_on_board and not u.is_demo and s.week_key=classstreak.monday(now(),u.tz) and s.venue_id is not null
 group by s.venue_id,u.id order by count(*) desc,u.first_name
$$;
create view public.venue_board with(security_invoker=true) as select * from public.cs_venue_board();
revoke all on public.venue_board from public,anon;grant select on public.venue_board to authenticated;
create function public.cs_studio(venue_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();n integer;regulars integer;name text;next_milestone integer;begin
 select v.name into name from classstreak.venues v where v.id=venue_id;if name is null then raise exception 'STUDIO_NOT_FOUND';end if;
 select count(*) into n from classstreak.sessions s where s.user_id=u and s.venue_id=cs_studio.venue_id and s.counted and s.removed_at is null;
 select min(x) into next_milestone from unnest(array[1,10,25,50,100,250]) x where x>n;
 with real_visits as(select s.*,row_number() over(partition by user_id,day_key,activity_key order by started_at,id) ordinal from classstreak.sessions s where s.source in('geofence','manual') and s.removed_at is null and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key)) and s.started_at>=now()-interval '30 days')
 select count(*) into regulars from(select s.user_id from real_visits s join classstreak.users p on p.id=s.user_id where s.venue_id=cs_studio.venue_id and s.ordinal=1 and p.show_on_board and not p.is_demo group by s.user_id having count(*)>=3) q;
 return jsonb_build_object('venue_id',venue_id,'name',name,'visits',n,'next_milestone',coalesce(next_milestone,500),'regulars',regulars,
 'sample_visits',exists(select 1 from classstreak.sessions where user_id=u and sessions.venue_id=cs_studio.venue_id and counted and removed_at is null and source in('seed','simulated')),
 'board',coalesce((select jsonb_agg(to_jsonb(b) order by b.weekly_count desc,b.name) from public.venue_board b where b.venue_id=cs_studio.venue_id),'[]'));
end $$;
create function public.cs_share_studio(place_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();p classstreak.places;code uuid;begin
 select * into p from classstreak.places where id=place_id and user_id=u;if not found then raise exception 'FORBIDDEN';end if;
 select id into code from classstreak.studio_links where created_by=u and venue_id=p.venue_id limit 1;
 if code is null then insert into classstreak.studio_links(venue_id,created_by,activity_key,radius_m) values(p.venue_id,u,p.activity_key,p.radius_m) returning id into code;end if;
 return code;
end $$;
create function public.cs_studio_preview(code uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',v.name,'google_place_id',v.google_place_id,'lat',v.lat,'lng',v.lng,'activity_key',l.activity_key,'radius_m',l.radius_m,'enabled',true,'share_name',true,'venue_id',v.id)
 from classstreak.studio_links l join classstreak.venues v on v.id=l.venue_id where l.id=code
$$;
revoke all on function public.cs_venue_board(),public.cs_studio(uuid),public.cs_share_studio(uuid),public.cs_studio_preview(uuid) from public,anon;
grant execute on function public.cs_venue_board(),public.cs_studio(uuid),public.cs_share_studio(uuid),public.cs_studio_preview(uuid) to authenticated;
grant execute on function public.cs_studio_preview(uuid) to anon;

alter table classstreak.users add column deletion_requested boolean not null default false;
create or replace function classstreak.me() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid;deleting boolean;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id,deletion_requested into u,deleting from classstreak.users where auth_id=auth.uid() and not is_demo;
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if deleting then raise exception 'ACCOUNT_DELETING';end if;return u;
end $$;
create function public.cs_health(workouts jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();w jsonb;start_time timestamptz;end_time timestamptz;updated integer:=0;n integer;begin
 if not (select health_verify from classstreak.users where id=u) then raise exception 'HEALTH_DISABLED';end if;
 if jsonb_typeof(workouts)<>'array' or jsonb_array_length(workouts)>100 then raise exception 'INVALID_BATCH';end if;
 for w in select * from jsonb_array_elements(workouts) loop
  start_time:=(w->>'started_at')::timestamptz;end_time:=(w->>'ended_at')::timestamptz;
  if end_time<start_time or end_time>now()+interval '2 minutes' or start_time<now()-interval '31 days' or end_time-start_time>interval '24 hours' then continue;end if;
  update classstreak.sessions s set verified=true,health_workout_id=(w->>'id')::uuid::text where s.user_id=u and s.source='geofence' and s.removed_at is null and not s.verified and least(s.ended_at,end_time)-greatest(s.started_at,start_time)>=interval '15 minutes';get diagnostics n=row_count;updated:=updated+n;
 end loop;return updated;
end $$;
create function classstreak.health_disabled() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.health_verify and not new.health_verify then update classstreak.sessions set verified=false,health_workout_id=null where user_id=new.id and (verified or health_workout_id is not null);end if;return new;
end $$;
create trigger cs_health_disabled after update of health_verify on classstreak.users for each row execute function classstreak.health_disabled();
create function public.cs_prepare_delete() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id into u from classstreak.users where auth_id=auth.uid();
 update classstreak.users set deletion_requested=true,tracking_consent=false,show_on_board=false,share_place_name=false where id=u;
 update classstreak.tracking_devices set active=false where user_id=u;
 delete from classstreak.visit_candidates where user_id=u;
 delete from classstreak.friendships where u in(user_a,user_b);
 return jsonb_build_object('prepared',true);
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_health(jsonb),public.cs_prepare_delete() from public,anon;
grant execute on function public.cs_health(jsonb),public.cs_prepare_delete() to authenticated;

create function classstreak.achievements(viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with eligible as (
  select s.*,row_number() over(partition by s.user_id,s.day_key,s.activity_key order by s.started_at,s.id) as daily_order
  from classstreak.sessions s join classstreak.users u on u.id=s.user_id join classstreak.activities a on a.key=s.activity_key
  where s.removed_at is null and s.started_at<=now() and (s.source='manual' or s.duration_sec>=a.min_minutes*60)
   and (u.id=viewer or classstreak.friends(viewer,u.id))
   and (u.id=viewer or s.source in('geofence','manual') or u.share_simulated or (u.is_demo and u.demo_owner=viewer))
 ), numbered as (
  select e.*,row_number() over(partition by user_id order by started_at,id) as milestone from eligible e where daily_order=1
 )
 select coalesce(jsonb_agg(item order by stamp desc),'[]') from (
  select n.started_at as stamp,jsonb_build_object('id',n.id,'user_id',n.user_id,'first_name',u.first_name,'count',n.milestone,'source',n.source) as item
  from numbered n join classstreak.users u on u.id=n.user_id
  where n.milestone in(1,10,25,50,100,250) and n.started_at>now()-interval '90 days' and classstreak.can_see_session(viewer,n.id)
  order by n.started_at desc limit 30
 ) q
$$;
create or replace function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;begin
 result:=public.cs_snapshot_base();
 return result||jsonb_build_object('friends',classstreak.friend_list(u),'feed',coalesce((select jsonb_agg(to_jsonb(f)) from public.friend_feed f),'[]'),'achievements',classstreak.achievements(u));
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;

-- Incremental change request 1. Existing sessions, identities and weekly targets survive.
alter table classstreak.users alter column theme set default 'clay';
create table classstreak.activity_schedules (
 user_id uuid references classstreak.users on delete cascade,
 activity_key text references classstreak.activities, weekday integer check(weekday between 0 and 6),
 time_of_day text not null check(time_of_day in('morning','midday','evening')),
 primary key(user_id,activity_key,weekday)
);
alter table classstreak.activity_schedules enable row level security;
insert into classstreak.activity_schedules
 select d.user_id,a.activity_key,d.weekday,d.time_of_day from classstreak.usual_days d join classstreak.user_activities a on a.user_id=d.user_id;
create function classstreak.register_activity(k text) returns void language plpgsql security definer set search_path='' as $$
begin
 if k like 'custom:%' then
  if length(substr(k,8)) not between 1 and 40 or trim(substr(k,8))<>substr(k,8) or k ~ '[[:cntrl:]]' then raise exception 'INVALID_ACTIVITY';end if;
  insert into classstreak.activities values(k,substr(k,8),25,1) on conflict do nothing;
 elsif not exists(select 1 from classstreak.activities where key=k) then raise exception 'INVALID_ACTIVITY';end if;
end $$;
create function classstreak.save_schedules(u uuid,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;d jsonb;begin
 delete from classstreak.activity_schedules where user_id=u;
 for item in select value from jsonb_array_elements(items) loop
  if not exists(select 1 from classstreak.user_activities where user_id=u and activity_key=item->>'activity_key') then raise exception 'INVALID_ACTIVITY';end if;
  for d in select value from jsonb_array_elements(item->'days') loop
   insert into classstreak.activity_schedules values(u,item->>'activity_key',d::integer,item->>'time') on conflict(user_id,activity_key,weekday) do update set time_of_day=excluded.time_of_day;
  end loop;
 end loop;
 -- Compatibility for older phones and nudge scheduling: earliest selected time per day.
 delete from classstreak.usual_days where user_id=u;
 insert into classstreak.usual_days select distinct on(weekday) u,weekday,time_of_day from classstreak.activity_schedules where user_id=u order by weekday,case time_of_day when 'morning' then 0 when 'midday' then 1 else 2 end;
end $$;
alter function public.cs_bootstrap(jsonb) rename to cs_bootstrap_before_walkthrough;
revoke all on function public.cs_bootstrap_before_walkthrough(jsonb) from public,anon,authenticated;
create function public.cs_bootstrap(draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;k text;p jsonb;items jsonb;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if exists(select 1 from classstreak.users where auth_id=auth.uid()) then return public.cs_snapshot();end if;
 if jsonb_array_length(draft->'selected')>30 then raise exception 'ACTIVITY_LIMIT';end if;
 for k in select value from jsonb_array_elements_text(draft->'selected') loop perform classstreak.register_activity(k);end loop;
 perform public.cs_bootstrap_before_walkthrough((draft-'place')||jsonb_build_object('theme',coalesce(draft->>'theme','clay')));
 u:=classstreak.me();
 for p in select value from jsonb_array_elements(coalesce(draft->'places',case when draft->'place' is not null and draft->'place'<>'null' then jsonb_build_array(draft->'place') else '[]'::jsonb end)) loop perform classstreak.save_place(u,p);end loop;
 items:=draft->'schedules';
 if items is null then select jsonb_agg(jsonb_build_object('activity_key',value,'days',coalesce(draft->'days','[]'),'time',coalesce(draft->>'time','evening'))) into items from jsonb_array_elements_text(draft->'selected');end if;
 perform classstreak.save_schedules(u,items);
 return public.cs_snapshot();
end $$;
alter function public.cs_settings(text,jsonb) rename to cs_settings_before_walkthrough;
revoke all on function public.cs_settings_before_walkthrough(text,jsonb) from public,anon,authenticated;
create function public.cs_settings(kind text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();k text;items jsonb;begin
 perform 1 from classstreak.users where id=u for update;
 if kind='goals' then
  if jsonb_array_length(payload->'goals')>30 then raise exception 'ACTIVITY_LIMIT';end if;
  for k in select value->>'activity_key' from jsonb_array_elements(payload->'goals') loop perform classstreak.register_activity(k);end loop;
 elsif kind='days' then
  items:=payload->'schedules';
  if items is null then select jsonb_agg(jsonb_build_object('activity_key',activity_key,'days',payload->'days','time',payload->>'time')) into items from classstreak.user_activities where user_id=u;end if;
  perform classstreak.save_schedules(u,items);perform classstreak.touch(u);return public.cs_snapshot();
 end if;
 return public.cs_settings_before_walkthrough(kind,payload);
end $$;
alter function public.cs_snapshot() rename to cs_snapshot_before_walkthrough;
revoke all on function public.cs_snapshot_before_walkthrough() from public,anon,authenticated;
create function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;friends jsonb;begin
 result:=public.cs_snapshot_before_walkthrough();
 select coalesce(jsonb_agg(f||jsonb_build_object('week_details',coalesce((
  select jsonb_agg(jsonb_build_object('day',extract(isodow from s.day_key)::integer-1,'activity_key',s.activity_key,'workout_label',s.workout_label,
   'time_of_day',case when extract(hour from s.started_at at time zone peer.tz)<11 then 'morning' when extract(hour from s.started_at at time zone peer.tz)<16 then 'midday' else 'evening' end,'duration_sec',s.duration_sec) order by s.day_key,s.activity_key)
  from classstreak.sessions s join classstreak.users peer on peer.id=s.user_id
  where s.user_id=(f->>'id')::uuid and f->>'status'='accepted' and s.counted and s.week_key=classstreak.monday(now(),peer.tz) and classstreak.can_see_session(u,s.id)
 ),'[]'))),'[]') into friends from jsonb_array_elements(result->'friends') f;
 return result||jsonb_build_object('friends',friends,'usual_days',coalesce((select jsonb_agg(jsonb_build_object('activity_key',activity_key,'weekday',weekday,'time_of_day',time_of_day) order by weekday,activity_key) from classstreak.activity_schedules where user_id=u),'[]'));
end $$;
-- Allow a single system emoji sequence (including skin tones/ZWJ) without a fixed four-item list.
alter table classstreak.reactions drop constraint reactions_emoji_check;
alter table classstreak.reactions add constraint reactions_emoji_check check(length(emoji) between 1 and 24 and emoji !~ '[[:cntrl:][:space:][:alnum:]]');
revoke all on function classstreak.register_activity(text),classstreak.save_schedules(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb),public.cs_snapshot() from public,anon;
grant execute on function public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb),public.cs_snapshot() to authenticated;

-- Owner-isolated sample regulars. Public venue_board still contains real visits only.
create function classstreak.populate_demo_board(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare name text;f uuid;v uuid;z text;w date;j integer;stamp timestamptz;begin
 select tz into z from classstreak.users where id=u;w:=classstreak.monday(now(),z);
 foreach name in array array['Lena','Noah','Amara','Theo','Riley'] loop
  select id into f from classstreak.users where demo_owner=u and first_name=name limit 1;
  if f is null then insert into classstreak.users(first_name,last_name,tz,is_demo,demo_owner) values(name,'D',z,true,u) returning id into f;end if;
 end loop;
 for v in select distinct venue_id from classstreak.places where user_id=u and enabled loop
  for f in select id from classstreak.users where demo_owner=u loop
   for j in 0..2 loop
    stamp:=((w+j)::timestamp+interval '8 hours') at time zone z;
    if not exists(select 1 from classstreak.sessions where user_id=f and venue_id=v and day_key=w+j and activity_key='reformer' and source='seed') then
    insert into classstreak.sessions(user_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,week_key,day_key,event_key)
    values(f,v,'reformer','Reformer Pilates',stamp,stamp+interval '52 minutes',3120,'seed',w,w+j,'seed:board:'||v||':'||w||':'||j) on conflict(user_id,event_key) do nothing;
    end if;
   end loop;
  end loop;
 end loop;
 update classstreak.sessions set activity_key='yoga',workout_label='Yoga' where user_id in(select id from classstreak.users where demo_owner=u and first_name='Jess') and source='seed' and week_key=w and extract(isodow from day_key) in(1,2);
 for f in select id from classstreak.users where demo_owner=u loop perform classstreak.recount(f);end loop;
end $$;
alter function public.cs_seed_demo(boolean,jsonb) rename to cs_seed_demo_before_boards;
revoke all on function public.cs_seed_demo_before_boards(boolean,jsonb) from public,anon,authenticated;
create function public.cs_seed_demo(remove_demo boolean default false,demo_places jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();begin
 perform public.cs_seed_demo_before_boards(remove_demo,demo_places);
 if not remove_demo then perform classstreak.populate_demo_board(u);end if;
 return public.cs_snapshot();
end $$;
alter function public.cs_studio(uuid) rename to cs_studio_before_demo_board;
revoke all on function public.cs_studio_before_demo_board(uuid) from public,anon,authenticated;
create or replace function public.cs_studio_before_demo_board(venue_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();n integer;regulars integer;name text;next_milestone integer;begin
 select v.name into name from classstreak.venues v where v.id=venue_id;if name is null then raise exception 'STUDIO_NOT_FOUND';end if;
 select count(*) into n from classstreak.sessions s where s.user_id=u and s.venue_id=cs_studio_before_demo_board.venue_id and s.counted and s.removed_at is null;
 select min(x) into next_milestone from unnest(array[1,10,25,50,100,250]) x where x>n;
 with real_visits as(select s.*,row_number() over(partition by user_id,day_key,activity_key order by started_at,id) ordinal from classstreak.sessions s where s.source in('geofence','manual') and s.removed_at is null and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key)) and s.started_at>=now()-interval '30 days')
 select count(*) into regulars from(select s.user_id from real_visits s join classstreak.users p on p.id=s.user_id where s.venue_id=cs_studio_before_demo_board.venue_id and s.ordinal=1 and p.show_on_board and not p.is_demo group by s.user_id having count(*)>=3) q;
 return jsonb_build_object('venue_id',venue_id,'name',name,'visits',n,'next_milestone',coalesce(next_milestone,500),'regulars',regulars,
 'sample_visits',exists(select 1 from classstreak.sessions where user_id=u and sessions.venue_id=cs_studio_before_demo_board.venue_id and counted and removed_at is null and source in('seed','simulated')),
 'board',coalesce((select jsonb_agg(to_jsonb(b) order by b.weekly_count desc,b.name) from public.venue_board b where b.venue_id=cs_studio_before_demo_board.venue_id),'[]'));
end $$;

create function public.cs_studio(venue_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;board jsonb;begin
 result:=public.cs_studio_before_demo_board(venue_id);
 if exists(select 1 from classstreak.sessions where user_id=u and source='seed' and removed_at is null) and exists(select 1 from classstreak.places where user_id=u and places.venue_id=cs_studio.venue_id) then
  select coalesce(jsonb_agg(row order by row->>'name'),'[]') into board from (
   select jsonb_build_object('row_id',md5(peer.id::text||cs_studio.venue_id::text),'name',peer.first_name||' '||left(peer.last_name,1)||'.','weekly_count',count(distinct(s.day_key,s.activity_key)),'is_me',false) row
   from classstreak.sessions s join classstreak.users peer on peer.id=s.user_id
   where peer.demo_owner=u and s.source='seed' and s.venue_id=cs_studio.venue_id and s.week_key=classstreak.monday(now(),peer.tz) and s.removed_at is null group by peer.id
  ) q;
  if jsonb_array_length(board)>0 then result:=result||jsonb_build_object('demo_board',true,'board',board,'regulars',jsonb_array_length(board));end if;
 end if;
 return result;
end $$;
revoke all on function classstreak.populate_demo_board(uuid) from public,anon,authenticated;
revoke all on function public.cs_seed_demo(boolean,jsonb),public.cs_studio(uuid) from public,anon;
grant execute on function public.cs_seed_demo(boolean,jsonb),public.cs_studio(uuid) to authenticated;
-- Add the requested sample regulars only to accounts that already opted into demo data.
do $$declare u uuid;begin for u in select distinct user_id from classstreak.sessions where source='seed' and user_id in(select id from classstreak.users where not is_demo) loop perform classstreak.populate_demo_board(u);end loop;end $$;

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

COMMIT;
