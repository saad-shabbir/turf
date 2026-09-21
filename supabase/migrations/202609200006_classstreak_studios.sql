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
