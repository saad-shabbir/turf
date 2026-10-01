-- Accepted friends can open a small safe profile and send one real inbox nudge
-- on any day with no completed workout, using the recipient's current local day.
create function classstreak.worked_out_today(peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from classstreak.sessions s join classstreak.users p on p.id=s.user_id
  where p.id=peer and not p.is_demo and s.source in('geofence','manual') and s.removed_at is null
   and s.duration_sec>0 and s.ended_at<=now()
   and (s.ended_at at time zone p.tz)::date=(now() at time zone p.tz)::date)
$$;
create function classstreak.nudge_available(viewer uuid,peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select viewer<>peer and classstreak.friends(viewer,peer) and exists(
  select 1 from classstreak.users p where p.id=peer and not p.is_demo
   and p.notification_preferences->>'nudge' is distinct from 'false'
   and not classstreak.worked_out_today(peer)
   and not exists(select 1 from classstreak.nudges n where n.from_user=viewer and n.to_user=peer and n.sent_on=(now() at time zone p.tz)::date))
$$;
create function classstreak.real_friend_streak(peer uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
declare w date;current_week date;z text;target integer;n integer;result integer:=0;i integer;
begin
 select tz into z from classstreak.users where id=peer;current_week:=classstreak.monday(now(),z);w:=current_week;
 for i in 0..520 loop
  select goal into target from classstreak.week_goals where user_id=peer and week_key<=w order by week_key desc limit 1;
  if target is null then exit;end if;
  select count(distinct(s.day_key,s.activity_key)) into n from classstreak.sessions s
   where s.user_id=peer and s.week_key=w and s.removed_at is null and s.source in('geofence','manual') and s.ended_at<=now()
    and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key));
  if target>0 and n>=target then result:=result+1;elsif w<current_week then exit;end if;w:=w-7;
 end loop;return result;
end $$;

alter function classstreak.friend_list(uuid) rename to friend_list_before_friend_profile;
revoke all on function classstreak.friend_list_before_friend_profile(uuid) from public,anon,authenticated;
create function classstreak.friend_list(viewer uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(f||jsonb_build_object(
  'worked_out_today',case when f->>'status'='accepted' then classstreak.worked_out_today((f->>'id')::uuid) else false end,
  'nudge_available',classstreak.nudge_available(viewer,(f->>'id')::uuid),
  'nudged_today',case when f->>'status'='accepted' then exists(select 1 from classstreak.nudges n join classstreak.users p on p.id=n.to_user where n.from_user=viewer and n.to_user=(f->>'id')::uuid and n.sent_on=(now() at time zone p.tz)::date) else false end
 ) order by f->>'first_name'),'[]') from jsonb_array_elements(classstreak.friend_list_before_friend_profile(viewer)) f
$$;

create function public.cs_friend_profile(peer uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();p classstreak.users;w date;n integer;target integer;details jsonb;
begin
 if peer=u or not classstreak.friends(u,peer) then raise exception 'FORBIDDEN';end if;
 select * into p from classstreak.users where id=peer and not is_demo;
 if not found then raise exception 'FORBIDDEN';end if;
 w:=classstreak.monday(now(),p.tz);
 select coalesce(goal,0) into target from classstreak.week_goals where user_id=peer and week_key<=w order by week_key desc limit 1;
 with eligible as (
  select s.*,row_number() over(partition by s.day_key,s.activity_key order by s.started_at,s.id) daily_order
  from classstreak.sessions s where s.user_id=peer and s.week_key=w and s.source in('geofence','manual')
   and s.ended_at<=now() and classstreak.can_see_session(u,s.id)
 ) select count(*),coalesce(jsonb_agg(jsonb_build_object(
   'day',extract(isodow from day_key)::integer-1,'activity_key',activity_key,'workout_label',workout_label,
   'time_of_day',case when extract(hour from started_at at time zone p.tz)<11 then 'morning' when extract(hour from started_at at time zone p.tz)<16 then 'midday' else 'evening' end,
   'duration_sec',duration_sec) order by day_key,activity_key),'[]') into n,details from eligible where daily_order=1;
 return jsonb_build_object('id',p.id,'first_name',p.first_name,'is_demo',false,
  'weekly_count',n,'weekly_goal',coalesce(target,0),'streak',classstreak.real_friend_streak(peer),
  'worked_out_today',classstreak.worked_out_today(peer),'nudge_available',classstreak.nudge_available(u,peer),
  'nudged_today',exists(select 1 from classstreak.nudges where from_user=u and to_user=peer and sent_on=(now() at time zone p.tz)::date),
  'week_details',details);
end $$;

alter function public.cs_social(text,jsonb) rename to cs_social_before_friend_profile;
revoke all on function public.cs_social_before_friend_profile(text,jsonb) from public,anon,authenticated;
create function public.cs_social(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();peer uuid;day date;name text;
begin
 if action<>'nudge' then return public.cs_social_before_friend_profile(action,payload);end if;
 peer:=(payload->>'id')::uuid;
 -- A finishing workout and preference edits lock the recipient user too. Wait
 -- for those writes before eligibility, with a fixed order for reciprocal sends.
 perform 1 from classstreak.users where id in(u,peer) order by id for update;
 -- Serialize a send with revocation of this exact friendship. Guessed IDs,
 -- pending requests and removed friendships cannot produce an inbox message.
 perform 1 from classstreak.friendships where user_a=least(u,peer) and user_b=greatest(u,peer) and status='accepted' for update;
 if not found or peer=u then raise exception 'NUDGE_UNAVAILABLE';end if;
 select (now() at time zone tz)::date into day from classstreak.users where id=peer and not is_demo;
 if day is null then raise exception 'NUDGE_UNAVAILABLE';end if;
 -- A retried successful request is a no-op, even if the response was lost.
 if exists(select 1 from classstreak.nudges where from_user=u and to_user=peer and sent_on=day) then return public.cs_snapshot();end if;
 if not classstreak.nudge_available(u,peer) then raise exception 'NUDGE_UNAVAILABLE';end if;
 perform classstreak.throttle(u,'social',300);
 select first_name into name from classstreak.users where id=u;
 insert into classstreak.nudges(from_user,to_user,sent_on) values(u,peer,day) on conflict do nothing;
 if found then perform classstreak.inform(peer,'nudge',u,null,name||' is cheering you on. Ready for your workout today?');end if;
 perform classstreak.touch(u);return public.cs_snapshot();
end $$;
revoke all on function classstreak.worked_out_today(uuid),classstreak.nudge_available(uuid,uuid),classstreak.real_friend_streak(uuid),classstreak.friend_list(uuid) from public,anon,authenticated;
revoke all on function public.cs_friend_profile(uuid),public.cs_social(text,jsonb) from public,anon;
grant execute on function public.cs_friend_profile(uuid),public.cs_social(text,jsonb) to authenticated;
