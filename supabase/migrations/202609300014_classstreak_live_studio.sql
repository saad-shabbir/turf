-- A separate real-data RPC lets older apps retain their explicit sample walkthrough.
-- This does not delete seeds, change friendships, or expose stable profile IDs.
create function public.cs_studio_live(venue_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;n integer;next_milestone integer;
begin
 result:=public.cs_studio_before_demo_board(venue_id);
 -- Legacy demo data can own the old counted flag for a day. Rank real eligible
 -- sessions independently, using the same day/activity rule as the public board.
 with real_visits as (
  select s.*,row_number() over(partition by day_key,activity_key order by started_at,id) ordinal
  from classstreak.sessions s where s.user_id=u and s.source in('geofence','manual')
   and s.removed_at is null and s.started_at<=now()
   and (s.source='manual' or s.duration_sec>=(select a.min_minutes*60 from classstreak.activities a where a.key=s.activity_key))
 ) select count(*) into n from real_visits s where s.venue_id=cs_studio_live.venue_id and s.ordinal=1;
 select min(x) into next_milestone from unnest(array[1,10,25,50,100,250]) x where x>n;
 return result||jsonb_build_object('visits',n,'next_milestone',coalesce(next_milestone,500),'sample_visits',false,'demo_board',false);
end $$;
revoke all on function public.cs_studio_live(uuid) from public,anon;
grant execute on function public.cs_studio_live(uuid) to authenticated;
