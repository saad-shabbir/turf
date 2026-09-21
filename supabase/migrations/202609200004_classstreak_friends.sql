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
 select exists(select 1 from classstreak.sessions s join classstreak.users u on u.id=s.user_id where s.id=sid and s.removed_at is null and (
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
  select count(distinct(day_key,activity_key)) into n from classstreak.sessions where user_id=peer and week_key=w and removed_at is null and (source in('geofence','manual') or sim);
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
