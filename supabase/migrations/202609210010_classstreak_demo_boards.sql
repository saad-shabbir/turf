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
