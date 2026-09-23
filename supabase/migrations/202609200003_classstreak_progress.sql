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
