-- Profiles show a weekly plan even before a friend opens the version that
-- uploads it. Someone with no synced plan rows at all falls back to their usual
-- days (activity schedules, or the older usual_days list), shown by period with
-- no exact time. Once they have synced, only their real plan is used.
-- Days are dates in the person's own time zone (cs_profile_plan picks them).
-- Rollback: re-create plan_days from 202610280018.
create or replace function classstreak.plan_days(viewer uuid,peer uuid,first_day date,days integer) returns jsonb language sql stable security definer set search_path='' as $$
 with synced as (select exists(select 1 from classstreak.plans where user_id=$2) yes),
 usual as (
  select s.weekday,s.activity_key,s.time_of_day from classstreak.activity_schedules s where s.user_id=$2
  union all
  select d.weekday,coalesce((select ua.activity_key from classstreak.user_activities ua where ua.user_id=$2 order by ua.activity_key limit 1),'gym'),d.time_of_day
  from classstreak.usual_days d where d.user_id=$2 and not exists(select 1 from classstreak.activity_schedules s where s.user_id=$2)
 )
 select coalesce(jsonb_agg(jsonb_build_object('day',d::date,'weekday',extract(isodow from d)::integer-1,
  'planned',case when (select yes from synced) then
    coalesce((select jsonb_agg(jsonb_build_object('activity_key',p.activity_key,'workout_label',a.label,'time',to_char(p.planned_time,'HH24:MI'),'period',p.period) order by classstreak.plan_time(p.planned_time,p.period),p.slot)
     from classstreak.plans p join classstreak.activities a on a.key=p.activity_key where p.user_id=$2 and p.day=d::date),'[]')
   else
    coalesce((select jsonb_agg(jsonb_build_object('activity_key',x.activity_key,'workout_label',a.label,'time',null,'period',x.time_of_day) order by classstreak.plan_time(null,x.time_of_day),x.activity_key)
     from usual x join classstreak.activities a on a.key=x.activity_key where x.weekday=extract(isodow from d)::integer-1),'[]')
   end,
  -- A yes/no per day, so it is not limited to sessions after the friendship began.
  'done',exists(select 1 from classstreak.sessions s join classstreak.activities a on a.key=s.activity_key where s.user_id=$2 and s.day_key=d::date and s.removed_at is null
   and s.source in('geofence','manual') and s.ended_at<=now() and (s.source='manual' or s.duration_sec>=a.min_minutes*60))
 ) order by d),'[]') from generate_series($3,$3+$4-1,interval '1 day') d
$$;
revoke all on function classstreak.plan_days(uuid,uuid,date,integer) from public,anon,authenticated;

-- Message pushes show the sender's first name and the message text (trimmed to
-- 140 characters), replacing "New message from X". Same as 202610280018 otherwise.
create or replace function public.cs_messages(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
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
   -- Readable on the lock screen: the sender's first name and the message, up to 140 characters.
   perform classstreak.push(peer,'dm',u,name,case when length(msg)>140 then rtrim(left(msg,139))||'…' else msg end,jsonb_build_object('pane','dm:'||u::text));
  end if;
  return classstreak.thread(u,peer);
 end if;
 raise exception 'FORBIDDEN';
end $$;

revoke all on function public.cs_messages(text,jsonb) from public,anon;
grant execute on function public.cs_messages(text,jsonb) to authenticated;
