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
