-- Incremental change request 1. Existing sessions, identities and weekly targets survive.
alter table classstreak.users alter column theme set default 'clay';
create table classstreak.activity_schedules (
 user_id uuid references classstreak.users on delete cascade,
 activity_key text references classstreak.activities, weekday integer check(weekday between 0 and 6),
 time_of_day text not null check(time_of_day in('morning','midday','evening')),
 primary key(user_id,activity_key,weekday)
);
alter table classstreak.activity_schedules enable row level security;
insert into classstreak.activity_schedules
 select d.user_id,a.activity_key,d.weekday,d.time_of_day from classstreak.usual_days d join classstreak.user_activities a on a.user_id=d.user_id;
create function classstreak.register_activity(k text) returns void language plpgsql security definer set search_path='' as $$
begin
 if k like 'custom:%' then
  if length(substr(k,8)) not between 1 and 40 or trim(substr(k,8))<>substr(k,8) or k ~ '[[:cntrl:]]' then raise exception 'INVALID_ACTIVITY';end if;
  insert into classstreak.activities values(k,substr(k,8),25,1) on conflict do nothing;
 elsif not exists(select 1 from classstreak.activities where key=k) then raise exception 'INVALID_ACTIVITY';end if;
end $$;
create function classstreak.save_schedules(u uuid,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;d jsonb;begin
 delete from classstreak.activity_schedules where user_id=u;
 for item in select value from jsonb_array_elements(items) loop
  if not exists(select 1 from classstreak.user_activities where user_id=u and activity_key=item->>'activity_key') then raise exception 'INVALID_ACTIVITY';end if;
  for d in select value from jsonb_array_elements(item->'days') loop
   insert into classstreak.activity_schedules values(u,item->>'activity_key',d::integer,item->>'time') on conflict(user_id,activity_key,weekday) do update set time_of_day=excluded.time_of_day;
  end loop;
 end loop;
 -- Compatibility for older phones and nudge scheduling: earliest selected time per day.
 delete from classstreak.usual_days where user_id=u;
 insert into classstreak.usual_days select distinct on(weekday) u,weekday,time_of_day from classstreak.activity_schedules where user_id=u order by weekday,case time_of_day when 'morning' then 0 when 'midday' then 1 else 2 end;
end $$;
alter function public.cs_bootstrap(jsonb) rename to cs_bootstrap_before_walkthrough;
revoke all on function public.cs_bootstrap_before_walkthrough(jsonb) from public,anon,authenticated;
create function public.cs_bootstrap(draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;k text;p jsonb;items jsonb;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if exists(select 1 from classstreak.users where auth_id=auth.uid()) then return public.cs_snapshot();end if;
 if jsonb_array_length(draft->'selected')>30 then raise exception 'ACTIVITY_LIMIT';end if;
 for k in select value from jsonb_array_elements_text(draft->'selected') loop perform classstreak.register_activity(k);end loop;
 perform public.cs_bootstrap_before_walkthrough((draft-'place')||jsonb_build_object('theme',coalesce(draft->>'theme','clay')));
 u:=classstreak.me();
 for p in select value from jsonb_array_elements(coalesce(draft->'places',case when draft->'place' is not null and draft->'place'<>'null' then jsonb_build_array(draft->'place') else '[]'::jsonb end)) loop perform classstreak.save_place(u,p);end loop;
 items:=draft->'schedules';
 if items is null then select jsonb_agg(jsonb_build_object('activity_key',value,'days',coalesce(draft->'days','[]'),'time',coalesce(draft->>'time','evening'))) into items from jsonb_array_elements_text(draft->'selected');end if;
 perform classstreak.save_schedules(u,items);
 return public.cs_snapshot();
end $$;
alter function public.cs_settings(text,jsonb) rename to cs_settings_before_walkthrough;
revoke all on function public.cs_settings_before_walkthrough(text,jsonb) from public,anon,authenticated;
create function public.cs_settings(kind text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();k text;items jsonb;begin
 perform 1 from classstreak.users where id=u for update;
 if kind='goals' then
  if jsonb_array_length(payload->'goals')>30 then raise exception 'ACTIVITY_LIMIT';end if;
  for k in select value->>'activity_key' from jsonb_array_elements(payload->'goals') loop perform classstreak.register_activity(k);end loop;
 elsif kind='days' then
  items:=payload->'schedules';
  if items is null then select jsonb_agg(jsonb_build_object('activity_key',activity_key,'days',payload->'days','time',payload->>'time')) into items from classstreak.user_activities where user_id=u;end if;
  perform classstreak.save_schedules(u,items);perform classstreak.touch(u);return public.cs_snapshot();
 end if;
 return public.cs_settings_before_walkthrough(kind,payload);
end $$;
alter function public.cs_snapshot() rename to cs_snapshot_before_walkthrough;
revoke all on function public.cs_snapshot_before_walkthrough() from public,anon,authenticated;
create function public.cs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();result jsonb;friends jsonb;begin
 result:=public.cs_snapshot_before_walkthrough();
 select coalesce(jsonb_agg(f||jsonb_build_object('week_details',coalesce((
  select jsonb_agg(jsonb_build_object('day',extract(isodow from s.day_key)::integer-1,'activity_key',s.activity_key,'workout_label',s.workout_label,
   'time_of_day',case when extract(hour from s.started_at at time zone peer.tz)<11 then 'morning' when extract(hour from s.started_at at time zone peer.tz)<16 then 'midday' else 'evening' end,'duration_sec',s.duration_sec) order by s.day_key,s.activity_key)
  from classstreak.sessions s join classstreak.users peer on peer.id=s.user_id
  where s.user_id=(f->>'id')::uuid and f->>'status'='accepted' and s.counted and s.week_key=classstreak.monday(now(),peer.tz) and classstreak.can_see_session(u,s.id)
 ),'[]'))),'[]') into friends from jsonb_array_elements(result->'friends') f;
 return result||jsonb_build_object('friends',friends,'usual_days',coalesce((select jsonb_agg(jsonb_build_object('activity_key',activity_key,'weekday',weekday,'time_of_day',time_of_day) order by weekday,activity_key) from classstreak.activity_schedules where user_id=u),'[]'));
end $$;
-- Allow a single system emoji sequence (including skin tones/ZWJ) without a fixed four-item list.
alter table classstreak.reactions drop constraint reactions_emoji_check;
alter table classstreak.reactions add constraint reactions_emoji_check check(length(emoji) between 1 and 24 and emoji !~ '[[:cntrl:][:space:][:alnum:]]');
revoke all on function classstreak.register_activity(text),classstreak.save_schedules(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb),public.cs_snapshot() from public,anon;
grant execute on function public.cs_bootstrap(jsonb),public.cs_settings(text,jsonb),public.cs_snapshot() to authenticated;
