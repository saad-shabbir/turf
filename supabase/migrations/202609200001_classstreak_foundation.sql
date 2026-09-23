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
