-- Social notifications, 1:1 messages, profile photos, shared weekly plans and
-- photo-started workouts. Additive: every older function keeps working, and the
-- wrapped functions are renamed with a _before_social suffix.
--
-- Remote push is queued only for people who registered an Expo push token, and
-- is sent only after classstreak.push_config is enabled (needs an iOS build with
-- the push entitlement). Until then everything also reaches the in-app inbox.
--
-- Rollback: revoke execute on the new public functions from authenticated and
-- set push_config.enabled=false. No existing rows are changed or deleted.

alter table classstreak.users add column avatar_path text,add column share_plan boolean not null default true,
 add column handle text check(handle is null or handle ~ '^[a-z0-9_.]{3,20}$'),add column discoverable boolean not null default true;
create unique index users_handle_key on classstreak.users(handle) where handle is not null;

-- People can mute push alerts from one friend without unfriending them.
create table classstreak.mutes(
 user_id uuid not null references classstreak.users on delete cascade,
 peer uuid not null references classstreak.users on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,peer),check(user_id<>peer));

create table classstreak.push_tokens(
 token text primary key check(token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
 user_id uuid not null references classstreak.users on delete cascade,
 updated_at timestamptz not null default now());
create index on classstreak.push_tokens(user_id);
create table classstreak.push_outbox(
 id bigint generated always as identity primary key,
 user_id uuid not null references classstreak.users on delete cascade,
 kind text not null,title text not null,body text not null,data jsonb not null default '{}',
 send_after timestamptz not null default now(),created_at timestamptz not null default now(),
 claimed_at timestamptz,sent_at timestamptz,attempts integer not null default 0,error text);
create index on classstreak.push_outbox(send_after) where sent_at is null;
-- One row. Push sending stays off until the push entitlement ships in a build.
create table classstreak.push_config(id boolean primary key default true check(id),enabled boolean not null default false,endpoint text);
insert into classstreak.push_config default values;

create table classstreak.messages(
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references classstreak.users on delete cascade,
 recipient uuid not null references classstreak.users on delete cascade,
 client_id uuid not null,body text not null check(length(body) between 1 and 1000),
 created_at timestamptz not null default now(),read_at timestamptz,
 unique(sender,client_id),check(sender<>recipient));
create index on classstreak.messages(least(sender,recipient),greatest(sender,recipient),created_at desc);
create index on classstreak.messages(recipient) where read_at is null;

-- Concrete planned workouts, synced from the phone's weekly plan for last,
-- this and next week. Past days are written once and then kept as recorded.
create table classstreak.plans(
 user_id uuid not null references classstreak.users on delete cascade,
 day date not null,slot text not null check(length(slot) between 1 and 120),
 activity_key text not null references classstreak.activities,
 planned_time time,period text not null check(period in('morning','midday','evening')),
 primary key(user_id,day,slot));
-- At most one "hasn't started" alert per friend per planned session.
create table classstreak.plan_alerts(
 id uuid primary key default gen_random_uuid(),
 viewer uuid not null references classstreak.users on delete cascade,
 peer uuid not null references classstreak.users on delete cascade,
 day date not null,slot text not null,created_at timestamptz not null default now(),nudged_at timestamptz,
 unique(viewer,peer,day,slot));

-- A workout in progress, reported by the phone so friends can be told and a
-- forgotten timer can be closed. Timer workouts use their future session id.
create table classstreak.active_workouts(
 id uuid primary key,
 user_id uuid not null unique references classstreak.users on delete cascade,
 activity_key text not null references classstreak.activities,
 place_id uuid references classstreak.places on delete set null,
 started_at timestamptz not null,started_by text not null check(started_by in('button','photo','arrival')),
 last_activity_at timestamptz not null,announced_at timestamptz,created_at timestamptz not null default now());
create table classstreak.workout_photos(
 path text primary key,
 user_id uuid not null references classstreak.users on delete cascade,
 workout_id uuid not null,kind text not null check(kind in('pre','mid','post')),
 share_to_feed boolean not null default true,caption text check(length(caption)<=240),created_at timestamptz not null default now(),
 unique(workout_id,kind));

alter table classstreak.mutes enable row level security;
alter table classstreak.push_tokens enable row level security;
alter table classstreak.push_outbox enable row level security;
alter table classstreak.push_config enable row level security;
alter table classstreak.messages enable row level security;
alter table classstreak.plans enable row level security;
alter table classstreak.plan_alerts enable row level security;
alter table classstreak.active_workouts enable row level security;
alter table classstreak.workout_photos enable row level security;
revoke all on classstreak.mutes,classstreak.push_tokens,classstreak.push_outbox,classstreak.push_config,classstreak.messages,classstreak.plans,classstreak.plan_alerts,classstreak.active_workouts,classstreak.workout_photos from public,anon,authenticated;

-- Helpers -------------------------------------------------------------------

create function classstreak.touch_one(u uuid) returns void language sql security definer set search_path='' as $$
 insert into public.cs_revisions(auth_id) select auth_id from classstreak.users where id=u and auth_id is not null
 on conflict(auth_id) do update set revision=cs_revisions.revision+1
$$;
-- Same quiet hours as the phone's reminders: 22:00 to 07:00 local time.
create function classstreak.quiet_until(zone text,at_time timestamptz default now()) returns timestamptz language sql stable set search_path='' as $$
 select case when extract(hour from at_time at time zone zone)>=22 then (((at_time at time zone zone)::date+1)+time '07:00') at time zone zone
  when extract(hour from at_time at time zone zone)<7 then ((at_time at time zone zone)::date+time '07:00') at time zone zone end
$$;
create function classstreak.activity_phrase(k text) returns text language sql stable security definer set search_path='' as $$
 select case when k='gym' then 'the gym' when k like 'custom:%' then substr(k,8) else lower(coalesce((select label from classstreak.activities where key=k),'a workout')) end
$$;

-- Wake the push sender when it is configured. pg_net is optional: without it,
-- the scheduled sender in supabase/schedule-classstreak-social.sql drains the queue.
create function classstreak.dispatch_push() returns void language plpgsql security definer set search_path='' as $$
declare c classstreak.push_config;begin
 select * into c from classstreak.push_config where id;
 if not coalesce(c.enabled,false) or c.endpoint is null then return;end if;
 begin execute 'select net.http_post(url:=$1,body:=''{}''::jsonb)' using c.endpoint;exception when others then null;end;
end $$;

create function classstreak.push(recipient uuid,k text,sender uuid,title text,message text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare r classstreak.users;begin
 if recipient is not distinct from sender then return;end if;
 select * into r from classstreak.users where id=recipient;
 if not found or r.is_demo or r.notification_preferences->>k='false' then return;end if;
 if sender is not null and exists(select 1 from classstreak.mutes where user_id=recipient and peer=sender) then return;end if;
 -- Nothing to deliver to yet (the current build cannot register for push).
 if not exists(select 1 from classstreak.push_tokens where user_id=recipient) then return;end if;
 insert into classstreak.push_outbox(user_id,kind,title,body,data,send_after)
 values(recipient,k,left(title,80),left(message,240),payload||jsonb_build_object('kind',k),coalesce(classstreak.quiet_until(r.tz),now()));
 perform classstreak.dispatch_push();
end $$;

-- Every inbox event that people asked to hear about also queues a push.
alter function classstreak.inform(uuid,text,uuid,uuid,text) rename to inform_before_social;
create function classstreak.inform(recipient uuid,k text,sender uuid,sid uuid,message text) returns void language plpgsql security definer set search_path='' as $$
declare name text;begin
 -- A muted friend's activity alerts are dropped; their nudges still reach the inbox quietly.
 if k in('friend_started','plan_missed') and exists(select 1 from classstreak.mutes where user_id=recipient and peer=sender) then return;end if;
 perform classstreak.inform_before_social(recipient,k,sender,sid,message);
 if k in('nudge','friend_started','plan_missed','workout_stopped') then
  select first_name into name from classstreak.users where id=sender;
  perform classstreak.push(recipient,case when k='workout_stopped' then 'workout_check' else k end,sender,coalesce(name,'ClassStreak'),message,
   jsonb_build_object('pane',case when k in('friend_started','plan_missed') then 'friend:'||sender::text when k='nudge' then 'friends' else 'history' end));
 end if;
end $$;

-- Push tokens -----------------------------------------------------------------

create function public.cs_push_token(push_token text,enabled boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if not enabled then delete from classstreak.push_tokens t where t.token=push_token and t.user_id=u;return jsonb_build_object('registered',false);end if;
 if push_token is null or push_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'INVALID_TOKEN';end if;
 perform classstreak.throttle(u,'push_token',50);
 -- A phone that signs into another account moves its token with it.
 insert into classstreak.push_tokens(token,user_id) values(push_token,u) on conflict on constraint push_tokens_pkey do update set user_id=u,updated_at=now();
 delete from classstreak.push_tokens t where t.user_id=u and t.token not in(select x.token from classstreak.push_tokens x where x.user_id=u order by x.updated_at desc limit 5);
 return jsonb_build_object('registered',true);
end $$;

-- Service-only: the send_push Edge Function claims due pushes and reports back.
create function public.cs_push_claim(max_items integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 delete from classstreak.push_outbox where sent_at is null and created_at<now()-interval '1 day';
 delete from classstreak.push_outbox where sent_at<now()-interval '7 days';
 with due as(
  select id from classstreak.push_outbox where sent_at is null and send_after<=now() and attempts<5 and (claimed_at is null or claimed_at<now()-interval '2 minutes')
  order by id limit least(greatest(coalesce(max_items,100),1),500) for update skip locked
 ),claimed as(
  update classstreak.push_outbox o set claimed_at=now(),attempts=o.attempts+1 from due where o.id=due.id returning o.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'body',c.body,'data',c.data,
   'tokens',(select coalesce(jsonb_agg(t.token),'[]') from classstreak.push_tokens t where t.user_id=c.user_id))),'[]') into result from claimed c;
 return result;
end $$;
create function public.cs_push_done(results jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;begin
 for r in select value from jsonb_array_elements(coalesce(results,'[]')) loop
  if (r->>'ok')::boolean then update classstreak.push_outbox set sent_at=now(),error=null where id=(r->>'id')::bigint;
  else update classstreak.push_outbox set error=left(r->>'error',200),claimed_at=null where id=(r->>'id')::bigint;end if;
  delete from classstreak.push_tokens where token in(select jsonb_array_elements_text(coalesce(r->'invalid_tokens','[]')));
 end loop;
end $$;

-- Profile photos --------------------------------------------------------------
-- Stored in the private photo bucket under {auth id}/avatar/, so account deletion
-- removes them with the rest of the person's photos.

create function public.cs_can_write_social_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and classstreak.me() is not null and split_part($1,'/',1)=auth.uid()::text and (
  $1 ~ '^[0-9a-f-]{36}/avatar/[0-9a-f-]{36}\.jpg$'
  or ($1 ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
   and exists(select 1 from classstreak.active_workouts w where w.id::text=split_part($1,'/',2) and w.user_id=classstreak.me())))
$$;
create function public.cs_can_read_social_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  split_part($1,'/',1)=auth.uid()::text
  or exists(select 1 from classstreak.users p where p.avatar_path=$1 and exists(
    select 1 from classstreak.friendships f where f.user_a=least(p.id,classstreak.me()) and f.user_b=greatest(p.id,classstreak.me())))
  or exists(select 1 from classstreak.workout_photos wp join classstreak.users p on p.id=wp.user_id
    where wp.path=$1 and p.auth_id::text=split_part($1,'/',1) and wp.share_to_feed and (
     classstreak.can_see_session(classstreak.me(),wp.workout_id)
     or exists(select 1 from classstreak.active_workouts w where w.id=wp.workout_id and w.user_id=wp.user_id and classstreak.friends(classstreak.me(),w.user_id)))))
$$;
do $$begin
 if to_regclass('storage.buckets') is not null then
  create policy cs_social_photos_read on storage.objects for select to authenticated using(bucket_id='classstreak-photos' and public.cs_can_read_social_photo(name));
  create policy cs_social_photos_insert on storage.objects for insert to authenticated with check(bucket_id='classstreak-photos' and public.cs_can_write_social_photo(name));
  create policy cs_social_photos_update on storage.objects for update to authenticated using(bucket_id='classstreak-photos' and public.cs_can_write_social_photo(name)) with check(bucket_id='classstreak-photos' and public.cs_can_write_social_photo(name));
 end if;
end $$;
create function classstreak.uploaded(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare found_it boolean;begin
 if to_regclass('storage.objects') is null then raise exception 'STORAGE_NOT_READY';end if;
 execute 'select exists(select 1 from storage.objects where bucket_id=''classstreak-photos'' and name=$1)' into found_it using path;
 return found_it;
end $$;
create function public.cs_set_avatar(path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if path is not null then
  if path !~ '^[0-9a-f-]{36}/avatar/[0-9a-f-]{36}\.jpg$' or not public.cs_can_write_social_photo(path) then raise exception 'FORBIDDEN';end if;
  if not classstreak.uploaded(path) then raise exception 'PHOTO_NOT_UPLOADED';end if;
 end if;
 perform classstreak.throttle(u,'avatar',30);
 update classstreak.users set avatar_path=path where id=u;
 return public.cs_snapshot();
end $$;

-- Friends list, profile and nudges -------------------------------------------

alter function classstreak.friend_list(uuid) rename to friend_list_before_social;
create function classstreak.friend_list(viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(f||jsonb_build_object('avatar_path',p.avatar_path,'muted',exists(select 1 from classstreak.mutes m where m.user_id=$1 and m.peer=p.id)) order by f->>'first_name'),'[]')
 from jsonb_array_elements(classstreak.friend_list_before_social($1)) f left join classstreak.users p on p.id=(f->>'id')::uuid
$$;

-- An unanswered "hasn't started" alert from today allows one more nudge.
create function classstreak.plan_nudge(viewer uuid,peer uuid) returns uuid language sql stable security definer set search_path='' as $$
 select a.id from classstreak.plan_alerts a join classstreak.users p on p.id=a.peer
 where a.viewer=$1 and a.peer=$2 and a.nudged_at is null and a.day=(now() at time zone p.tz)::date and not p.is_demo
  and classstreak.friends($1,$2) and p.notification_preferences->>'nudge' is distinct from 'false' and not classstreak.worked_out_today($2)
 order by a.created_at limit 1
$$;
alter function classstreak.nudge_available(uuid,uuid) rename to nudge_available_daily;
create function classstreak.nudge_available(viewer uuid,peer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select classstreak.nudge_available_daily($1,$2) or classstreak.plan_nudge($1,$2) is not null
$$;

alter function public.cs_friend_profile(uuid) rename to cs_friend_profile_before_social;
create function public.cs_friend_profile(peer uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;begin
 result:=public.cs_friend_profile_before_social(peer);
 return result||jsonb_build_object('avatar_path',(select avatar_path from classstreak.users where id=peer),
  'muted',exists(select 1 from classstreak.mutes where user_id=u and mutes.peer=cs_friend_profile.peer));
end $$;

alter function public.cs_social(text,jsonb) rename to cs_social_before_social;
create function public.cs_social(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();target uuid;alert uuid;name text;result jsonb;begin
 if action in('mute','unmute') then
  target:=(payload->>'id')::uuid;
  if u is null or target is null or target=u or not exists(select 1 from classstreak.friendships where user_a=least(u,target) and user_b=greatest(u,target)) then raise exception 'FORBIDDEN';end if;
  if action='mute' then insert into classstreak.mutes(user_id,peer) values(u,target) on conflict do nothing;
  else delete from classstreak.mutes m where m.user_id=u and m.peer=target;end if;
  perform classstreak.touch_one(u);return public.cs_snapshot();
 end if;
 if action<>'nudge' then return public.cs_social_before_social(action,payload);end if;
 target:=(payload->>'id')::uuid;
 if u is not null and target is not null and target<>u then
  perform 1 from classstreak.users where id in(u,target) order by id for update;
  perform 1 from classstreak.friendships where user_a=least(u,target) and user_b=greatest(u,target) and status='accepted' for update;
  if found then alert:=classstreak.plan_nudge(u,target);end if;
 end if;
 -- The daily nudge was already used: answer the missed-plan alert instead.
 if alert is not null and not classstreak.nudge_available_daily(u,target) then
  perform classstreak.throttle(u,'social',300);
  update classstreak.plan_alerts set nudged_at=now() where id=alert and nudged_at is null;
  if found then
   select first_name into name from classstreak.users where id=u;
   perform classstreak.inform(target,'nudge',u,null,name||' saw your plan and is cheering you on. There’s still time today.');
  end if;
  perform classstreak.touch(u);return public.cs_snapshot();
 end if;
 result:=public.cs_social_before_social(action,payload);
 -- One nudge answers today's alert too, so a miss never produces two.
 if alert is not null then update classstreak.plan_alerts set nudged_at=now() where id=alert and nudged_at is null;end if;
 return result;
end $$;

alter function public.cs_settings(text,jsonb) rename to cs_settings_before_social;
create function public.cs_settings(kind text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();h text;begin
 if kind='profile' and payload ? 'share_plan' then
  update classstreak.users set share_plan=(payload->>'share_plan')::boolean where id=u;
  if not (payload->>'share_plan')::boolean then delete from classstreak.plan_alerts where peer=u and nudged_at is null;end if;
 end if;
 if kind='profile' and payload ? 'discoverable' then update classstreak.users set discoverable=(payload->>'discoverable')::boolean where id=u;end if;
 if kind='profile' and payload ? 'handle' then
  h:=nullif(lower(btrim(ltrim(btrim(coalesce(payload->>'handle','')),'@'))),'');
  if h is not null and h !~ '^[a-z0-9_.]{3,20}$' then raise exception 'HANDLE_INVALID';end if;
  if h is not null and exists(select 1 from classstreak.users where handle=h and id<>u) then raise exception 'HANDLE_TAKEN';end if;
  perform classstreak.throttle(u,'handle',20);
  update classstreak.users set handle=h where id=u;
 end if;
 return public.cs_settings_before_social(kind,payload-'share_plan'-'discoverable'-'handle');
end $$;

-- People search -------------------------------------------------------------------
-- Live name or @handle search for adding friends. Returns first name, last
-- initial and handle only; people can turn discoverability off in Account.
create function public.cs_people_search(query text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();q text;pattern text;begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 q:=lower(btrim(ltrim(btrim(coalesce(query,'')),'@')));
 if length(q)<2 then return '[]';end if;
 q:=left(q,40);pattern:=replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 perform classstreak.throttle(u,'search',600);
 return coalesce((select jsonb_agg(x order by x->>'rank',x->>'first_name') from (
  select jsonb_build_object('id',p.id,'first_name',p.first_name,'last_initial',upper(left(btrim(p.last_name),1)),'handle',p.handle,
   'rank',case when p.handle=q then '0' when p.handle like pattern then '1' else '2' end,
   'status',case when f.status='accepted' then 'friends' when f.status='pending' and f.requested_by=u then 'requested' when f.status='pending' then 'incoming' else 'none' end) x
  from classstreak.users p left join classstreak.friendships f on f.user_a=least(u,p.id) and f.user_b=greatest(u,p.id)
  where p.id<>u and not p.is_demo and p.auth_id is not null and (p.discoverable or f.user_a is not null)
   and (p.handle like pattern or lower(p.first_name) like pattern or lower(coalesce(p.last_name,'')) like pattern or lower(p.first_name||' '||coalesce(p.last_name,'')) like pattern)
  order by case when p.handle=q then 0 when p.handle like pattern then 1 else 2 end,p.first_name,p.id limit 20) q2),'[]');
end $$;

-- Messages ---------------------------------------------------------------------

create function classstreak.thread(viewer uuid,peer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('peer',jsonb_build_object('id',p.id,'first_name',p.first_name,'avatar_path',p.avatar_path),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'client_id',case when m.sender=$1 then m.client_id end,'from_me',m.sender=$1,'body',m.body,'created_at',m.created_at,'read',m.read_at is not null) order by m.created_at,m.id)
   from (select * from classstreak.messages x where least(x.sender,x.recipient)=least($1,$2) and greatest(x.sender,x.recipient)=greatest($1,$2) order by x.created_at desc,x.id desc limit 200) m),'[]'))
 from classstreak.users p where p.id=$2
$$;
create function public.cs_messages(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();peer uuid;msg text;name text;cid uuid;begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if action='list' then
  return coalesce((select jsonb_agg(c order by c->>'last_at' desc) from (
   select jsonb_build_object('peer_id',p.id,'first_name',p.first_name,'avatar_path',p.avatar_path,
    'last_body',l.body,'last_from_me',l.sender=u,'last_at',l.created_at,
    'unread',(select count(*) from classstreak.messages m where m.sender=p.id and m.recipient=u and m.read_at is null)) c
   from classstreak.users p cross join lateral (select * from classstreak.messages m where least(m.sender,m.recipient)=least(u,p.id) and greatest(m.sender,m.recipient)=greatest(u,p.id) order by m.created_at desc,m.id desc limit 1) l
   where p.id<>u and classstreak.friends(u,p.id)) q),'[]');
 end if;
 peer:=(payload->>'peer')::uuid;
 if peer is null or peer=u or not classstreak.friends(u,peer) or exists(select 1 from classstreak.users where id=peer and is_demo) then raise exception 'FORBIDDEN';end if;
 if action='thread' then return classstreak.thread(u,peer);end if;
 if action='read' then
  update classstreak.messages set read_at=now() where recipient=u and sender=peer and read_at is null;
  if found then perform classstreak.touch_one(u);end if;
  return classstreak.thread(u,peer);
 end if;
 if action='send' then
  msg:=btrim(payload->>'body');cid:=(payload->>'client_id')::uuid;
  if msg is null or length(msg) not between 1 and 1000 or cid is null then raise exception 'INVALID_MESSAGE';end if;
  -- Serialize with unfriending, which locks this row before deleting it.
  perform 1 from classstreak.friendships where user_a=least(u,peer) and user_b=greatest(u,peer) and status='accepted' for update;
  if not found then raise exception 'FORBIDDEN';end if;
  -- A retried send with the same client id is a no-op.
  if not exists(select 1 from classstreak.messages where sender=u and client_id=cid) then
   perform classstreak.throttle(u,'dm',500);
   insert into classstreak.messages(sender,recipient,client_id,body) values(u,peer,cid,msg);
   select first_name into name from classstreak.users where id=u;
   perform classstreak.touch_one(peer);
   perform classstreak.push(peer,'dm',u,name,msg,jsonb_build_object('pane','dm:'||u::text));
  end if;
  return classstreak.thread(u,peer);
 end if;
 raise exception 'FORBIDDEN';
end $$;

-- Weekly plans -----------------------------------------------------------------

create function public.cs_plan_sync(items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();z text;monday date;today date;lower_day date;upper_day date;item jsonb;d date;k text;t time;n integer:=0;begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 select tz into z from classstreak.users where id=u and not is_demo for update;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>120 then raise exception 'INVALID_PLAN';end if;
 perform classstreak.throttle(u,'plan',300);
 monday:=classstreak.monday(now(),z);today:=(now() at time zone z)::date;
 lower_day:=monday-7;upper_day:=monday+13;
 -- After the first sync, earlier days are a record: only today onward changes.
 if exists(select 1 from classstreak.plans where user_id=u) then lower_day:=today;end if;
 delete from classstreak.plans where user_id=u and day between lower_day and upper_day;
 for item in select value from jsonb_array_elements(items) loop
  d:=(item->>'day')::date;
  continue when d is null or d<lower_day or d>upper_day;
  k:=item->>'activity_key';perform classstreak.register_activity(k);
  t:=case when item->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (item->>'time')::time end;
  if coalesce(item->>'period','') not in('morning','midday','evening') or length(coalesce(item->>'slot',''))not between 1 and 120 then raise exception 'INVALID_PLAN';end if;
  insert into classstreak.plans(user_id,day,slot,activity_key,planned_time,period) values(u,d,item->>'slot',k,t,item->>'period') on conflict do nothing;
  n:=n+1;
 end loop;
 perform classstreak.touch(u);
 return jsonb_build_object('saved',n,'from',lower_day,'to',upper_day);
end $$;

create function classstreak.plan_days(viewer uuid,peer uuid,first_day date,days integer) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'weekday',extract(isodow from d)::integer-1,
  'planned',coalesce((select jsonb_agg(jsonb_build_object('activity_key',p.activity_key,'workout_label',a.label,'time',to_char(p.planned_time,'HH24:MI'),'period',p.period) order by coalesce(p.planned_time,case p.period when 'morning' then time '09:00' when 'midday' then time '13:00' else time '18:00' end),p.slot)
    from classstreak.plans p join classstreak.activities a on a.key=p.activity_key where p.user_id=$2 and p.day=d::date),'[]'),
  -- A yes/no per day, so it is not limited to sessions after the friendship began.
  'done',exists(select 1 from classstreak.sessions s join classstreak.activities a on a.key=s.activity_key where s.user_id=$2 and s.day_key=d::date and s.removed_at is null
   and s.source in('geofence','manual') and s.ended_at<=now() and (s.source='manual' or s.duration_sec>=a.min_minutes*60))
 ) order by d),'[]') from generate_series($3,$3+$4-1,interval '1 day') d
$$;
-- Friends-only: this week's and next week's plan, and how last week went.
create function public.cs_profile_plan(peer uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();target uuid;p classstreak.users;monday date;last_week jsonb;planned integer;completed integer;begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 target:=coalesce(peer,u);
 if target<>u and not classstreak.friends(u,target) then raise exception 'FORBIDDEN';end if;
 select * into p from classstreak.users where id=target and (id=u or not is_demo);
 if not found then raise exception 'FORBIDDEN';end if;
 if target<>u and not p.share_plan then return jsonb_build_object('shared',false);end if;
 monday:=classstreak.monday(now(),p.tz);
 last_week:=classstreak.plan_days(u,target,monday-7,7);
 select count(*) filter(where jsonb_array_length(x->'planned')>0),count(*) filter(where jsonb_array_length(x->'planned')>0 and (x->>'done')::boolean) into planned,completed from jsonb_array_elements(last_week) x;
 return jsonb_build_object('shared',true,'share_plan',p.share_plan,'today',(now() at time zone p.tz)::date,
  'this_week',classstreak.plan_days(u,target,monday,7),'next_week',classstreak.plan_days(u,target,monday+7,7),
  'last_week',jsonb_build_object('days',last_week,'planned_days',planned,'completed_days',completed,
   'percent',case when planned>0 then round(100.0*completed/planned)::integer end));
end $$;

-- Workouts in progress and their photos ---------------------------------------

create function public.cs_workout(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();w classstreak.active_workouts;wid uuid;starts timestamptz;k text;by_kind text;place uuid;name text;f uuid;photo text;photo_kind text;begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 perform 1 from classstreak.users where id=u and not is_demo for update;
 if not found then raise exception 'SETUP_REQUIRED';end if;
 wid:=(payload->>'id')::uuid;
 if action='start' then
  starts:=(payload->>'started_at')::timestamptz;k:=payload->>'activity_key';by_kind:=coalesce(payload->>'started_by','button');place:=(payload->>'place_id')::uuid;
  if wid is null or starts is null or starts>now()+interval '2 minutes' or starts<now()-interval '4 hours' or by_kind not in('button','photo','arrival') then raise exception 'INVALID_WORKOUT';end if;
  if place is not null and not exists(select 1 from classstreak.places where id=place and user_id=u) then place:=null;end if;
  perform classstreak.register_activity(k);
  -- A finished timer already has a session with this id.
  if exists(select 1 from classstreak.sessions where id=wid) then return jsonb_build_object('active',false);end if;
  perform classstreak.throttle(u,'workout',60);
  select * into w from classstreak.active_workouts where user_id=u for update;
  if found and w.id=wid then
   update classstreak.active_workouts set activity_key=k,started_by=case when by_kind='photo' then 'photo' else started_by end where id=wid;
  else
   delete from classstreak.active_workouts where user_id=u;
   insert into classstreak.active_workouts(id,user_id,activity_key,place_id,started_at,started_by,last_activity_at) values(wid,u,k,place,least(starts,now()),by_kind,now());
  end if;
  select * into w from classstreak.active_workouts where id=wid;
  -- Friends hear about a fresh start once. A start synced late is not "just now".
  if w.announced_at is null and w.started_at>now()-interval '30 minutes' then
   update classstreak.active_workouts set announced_at=now() where id=wid;
   select first_name into name from classstreak.users where id=u;
   for f in select case when fr.user_a=u then fr.user_b else fr.user_a end from classstreak.friendships fr join classstreak.users p on p.id=case when fr.user_a=u then fr.user_b else fr.user_a end
    where u in(fr.user_a,fr.user_b) and fr.status='accepted' and not p.is_demo loop
    perform classstreak.inform(f,'friend_started',u,null,name||' just started '||classstreak.activity_phrase(k)||'. Cheer them on?');
   end loop;
  end if;
  perform classstreak.touch(u);
  return jsonb_build_object('active',true,'id',wid,'announced',w.announced_at is null and w.started_at>now()-interval '30 minutes');
 elsif action='ping' then
  update classstreak.active_workouts set last_activity_at=greatest(last_activity_at,least(now(),coalesce((payload->>'at')::timestamptz,now()))) where id=wid and user_id=u;
  return jsonb_build_object('active',found);
 elsif action='stop' then
  delete from classstreak.active_workouts where id=wid and user_id=u;
  if found then perform classstreak.touch(u);end if;
  return jsonb_build_object('active',false);
 elsif action='photo' then
  photo:=payload->>'path';photo_kind:=payload->>'kind';
  if photo_kind is null or photo_kind not in('pre','mid','post') or photo is null or split_part(photo,'/',2)<>wid::text or photo !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or split_part(photo,'/',1)<>auth.uid()::text then raise exception 'FORBIDDEN';end if;
  if not exists(select 1 from classstreak.active_workouts where id=wid and user_id=u) and not exists(select 1 from classstreak.sessions where id=wid and user_id=u and removed_at is null) then raise exception 'FORBIDDEN';end if;
  if exists(select 1 from classstreak.workout_photos wp where wp.path=photo and wp.user_id<>u) then raise exception 'FORBIDDEN';end if;
  if not classstreak.uploaded(photo) then raise exception 'PHOTO_NOT_UPLOADED';end if;
  perform classstreak.throttle(u,'workout_photo',40);
  delete from classstreak.workout_photos wp where wp.workout_id=wid and wp.kind=photo_kind and wp.user_id=u and wp.path<>photo;
  insert into classstreak.workout_photos(path,user_id,workout_id,kind,share_to_feed,caption) values(photo,u,wid,photo_kind,coalesce((payload->>'share')::boolean,true),nullif(left(btrim(payload->>'caption'),240),''))
   on conflict(path) do update set share_to_feed=excluded.share_to_feed,caption=excluded.caption;
  perform classstreak.touch(u);return public.cs_snapshot();
 elsif action='share' then
  update classstreak.workout_photos wp set share_to_feed=coalesce((payload->>'share')::boolean,true) where wp.path=payload->>'path' and wp.user_id=u;
  if not found then raise exception 'FORBIDDEN';end if;
  perform classstreak.touch(u);return public.cs_snapshot();
 end if;
 raise exception 'FORBIDDEN';
end $$;

-- Credit a forgotten timer up to the later of the 2-hour mark and the last time
-- the person used the app during the workout, never past 3 hours.
create function classstreak.credited_end(started timestamptz,last_activity timestamptz) returns timestamptz language sql immutable as $$
 select least(started+interval '3 hours',greatest(started+interval '2 hours',coalesce(last_activity,started)))
$$;
create function classstreak.close_forgotten_workout(w classstreak.active_workouts) returns void language plpgsql security definer set search_path='' as $$
declare z text;ends timestamptz;label text;begin
 select tz into z from classstreak.users where id=w.user_id for update;
 ends:=classstreak.credited_end(w.started_at,w.last_activity_at);
 if not exists(select 1 from classstreak.sessions where id=w.id) then
  select a.label into label from classstreak.activities a where a.key=w.activity_key;
  perform classstreak.ensure_week(w.user_id,w.started_at);
  insert into classstreak.sessions(id,user_id,place_id,venue_id,activity_key,workout_label,started_at,ended_at,duration_sec,source,verified,week_key,day_key,event_key)
  values(w.id,w.user_id,w.place_id,null,w.activity_key,label,w.started_at,ends,floor(extract(epoch from ends-w.started_at))::integer,'manual',false,classstreak.monday(w.started_at,z),(w.started_at at time zone z)::date,'button:'||w.id::text);
  perform classstreak.recount(w.user_id);
  perform classstreak.inform(w.user_id,'workout_stopped',null,w.id,'Your workout timer ran for 3 hours, so we stopped it and saved '||floor(extract(epoch from ends-w.started_at)/60)::integer||' minutes. You can edit it in History.');
 end if;
 delete from classstreak.active_workouts where id=w.id;
end $$;

-- When a timer's session is saved (by the phone or above), its live card ends.
create function classstreak.session_closes_live() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from classstreak.active_workouts where id=new.id;return new;end $$;
create trigger cs_session_closes_live after insert on classstreak.sessions for each row execute function classstreak.session_closes_live();

-- Live list for the feed: accepted friends who are working out right now.
create function classstreak.live_workouts(viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'user_id',p.id,'first_name',p.first_name,'avatar_path',p.avatar_path,
  'activity_key',w.activity_key,'workout_label',a.label,'started_at',w.started_at,
  'photo',(select wp.path from classstreak.workout_photos wp where wp.workout_id=w.id and wp.kind='pre' and wp.share_to_feed)) order by w.started_at desc),'[]')
 from classstreak.active_workouts w join classstreak.users p on p.id=w.user_id join classstreak.activities a on a.key=w.activity_key
 where w.started_at>now()-interval '4 hours' and p.id<>$1 and not p.is_demo and classstreak.friends($1,p.id)
$$;

-- Scheduled checks (every 5 minutes, see supabase/schedule-classstreak-social.sql)
create function classstreak.social_checks() returns void language plpgsql security definer set search_path='' as $$
declare r record;w classstreak.active_workouts;starts timestamptz;f uuid;msg text;begin
 for w in select * from classstreak.active_workouts where started_by in('button','photo') and started_at<=now()-interval '3 hours' loop
  perform classstreak.close_forgotten_workout(w);
 end loop;
 -- Arrival workouts close through location tracking; drop stale reports.
 delete from classstreak.active_workouts where started_by='arrival' and started_at<=now()-interval '4 hours';
 for r in select p.user_id,p.day,p.slot,p.activity_key,u.tz,u.first_name,
   coalesce(p.planned_time,case p.period when 'morning' then time '09:00' when 'midday' then time '13:00' else time '18:00' end) planned_at
  from classstreak.plans p join classstreak.users u on u.id=p.user_id
  where not u.is_demo and u.share_plan and p.day between current_date-1 and current_date+1 loop
  starts:=(r.day+r.planned_at) at time zone r.tz;
  continue when now()<starts+interval '1 hour' or now()>starts+interval '3 hours';
  continue when exists(select 1 from classstreak.active_workouts x where x.user_id=r.user_id)
   or exists(select 1 from classstreak.visit_candidates c where c.user_id=r.user_id)
   or exists(select 1 from classstreak.sessions s where s.user_id=r.user_id and s.day_key=r.day and s.removed_at is null and s.source in('geofence','manual'));
  msg:=r.first_name||' was planning '||classstreak.activity_phrase(r.activity_key)||' at '||to_char(r.planned_at,'FMHH12:MI AM')||' and hasn’t started. Nudge them?';
  for f in select case when fr.user_a=r.user_id then fr.user_b else fr.user_a end from classstreak.friendships fr join classstreak.users p on p.id=case when fr.user_a=r.user_id then fr.user_b else fr.user_a end
   where r.user_id in(fr.user_a,fr.user_b) and fr.status='accepted' and not p.is_demo and p.notification_preferences->>'plan_missed' is distinct from 'false'
    and not exists(select 1 from classstreak.mutes m where m.user_id=p.id and m.peer=r.user_id) loop
   insert into classstreak.plan_alerts(viewer,peer,day,slot) values(f,r.user_id,r.day,r.slot) on conflict do nothing;
   if found then perform classstreak.inform(f,'plan_missed',r.user_id,null,msg);end if;
  end loop;
 end loop;
 delete from classstreak.plan_alerts where day<current_date-14;
 perform classstreak.dispatch_push();
end $$;

-- Snapshot additions ------------------------------------------------------------

alter function public.cs_snapshot() rename to cs_snapshot_before_social;
revoke all on function public.cs_snapshot_before_social() from public,anon,authenticated;
create function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;begin
 result:=public.cs_snapshot_before_social();
 return result||jsonb_build_object(
  'feed',coalesce((select jsonb_agg(f||jsonb_build_object('avatar_path',p.avatar_path,'photos',coalesce((
    select jsonb_agg(jsonb_build_object('path',wp.path,'kind',wp.kind,'share_to_feed',wp.share_to_feed,'caption',wp.caption) order by array_position(array['pre','mid','post'],wp.kind))
    from classstreak.workout_photos wp where wp.workout_id=(f->>'id')::uuid and wp.user_id=(f->>'user_id')::uuid and (wp.share_to_feed or wp.user_id=u)),'[]')) order by x.n)
   from jsonb_array_elements(result->'feed') with ordinality x(f,n) left join classstreak.users p on p.id=(x.f->>'user_id')::uuid),'[]'),
  'live',classstreak.live_workouts(u),
  'active_workout',(select jsonb_build_object('id',w.id,'activity_key',w.activity_key,'started_at',w.started_at,'started_by',w.started_by) from classstreak.active_workouts w where w.user_id=u),
  'dm_unread',(select count(*) from classstreak.messages m where m.recipient=u and m.read_at is null and classstreak.friends(u,m.sender)));
end $$;

revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_people_search(text),public.cs_push_token(text,boolean),public.cs_set_avatar(text),public.cs_messages(text,jsonb),public.cs_plan_sync(jsonb),public.cs_profile_plan(uuid),public.cs_workout(text,jsonb),
 public.cs_friend_profile(uuid),public.cs_social(text,jsonb),public.cs_settings(text,jsonb),public.cs_snapshot(),public.cs_can_read_social_photo(text),public.cs_can_write_social_photo(text) from public,anon;
revoke all on function public.cs_friend_profile_before_social(uuid),public.cs_social_before_social(text,jsonb),public.cs_settings_before_social(text,jsonb) from public,anon,authenticated;
grant execute on function public.cs_people_search(text),public.cs_push_token(text,boolean),public.cs_set_avatar(text),public.cs_messages(text,jsonb),public.cs_plan_sync(jsonb),public.cs_profile_plan(uuid),public.cs_workout(text,jsonb),
 public.cs_friend_profile(uuid),public.cs_social(text,jsonb),public.cs_settings(text,jsonb),public.cs_snapshot(),public.cs_can_read_social_photo(text),public.cs_can_write_social_photo(text) to authenticated;
revoke all on function public.cs_push_claim(integer),public.cs_push_done(jsonb) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 grant execute on function public.cs_push_claim(integer),public.cs_push_done(jsonb) to service_role;end if;end $$;
