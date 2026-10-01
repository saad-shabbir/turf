alter table classstreak.users add column deletion_requested boolean not null default false;
create or replace function classstreak.me() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid;deleting boolean;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id,deletion_requested into u,deleting from classstreak.users where auth_id=auth.uid() and not is_demo;
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if deleting then raise exception 'ACCOUNT_DELETING';end if;return u;
end $$;
create function public.cs_health(workouts jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();w jsonb;start_time timestamptz;end_time timestamptz;updated integer:=0;n integer;begin
 if not (select health_verify from classstreak.users where id=u) then raise exception 'HEALTH_DISABLED';end if;
 if jsonb_typeof(workouts)<>'array' or jsonb_array_length(workouts)>100 then raise exception 'INVALID_BATCH';end if;
 for w in select * from jsonb_array_elements(workouts) loop
  start_time:=(w->>'started_at')::timestamptz;end_time:=(w->>'ended_at')::timestamptz;
  if end_time<start_time or end_time>now()+interval '2 minutes' or start_time<now()-interval '31 days' or end_time-start_time>interval '24 hours' then continue;end if;
  update classstreak.sessions s set verified=true,health_workout_id=(w->>'id')::uuid::text where s.user_id=u and s.source='geofence' and s.removed_at is null and not s.verified and least(s.ended_at,end_time)-greatest(s.started_at,start_time)>=interval '15 minutes';get diagnostics n=row_count;updated:=updated+n;
 end loop;return updated;
end $$;
create function classstreak.health_disabled() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.health_verify and not new.health_verify then update classstreak.sessions set verified=false,health_workout_id=null where user_id=new.id and (verified or health_workout_id is not null);end if;return new;
end $$;
create trigger cs_health_disabled after update of health_verify on classstreak.users for each row execute function classstreak.health_disabled();
create function public.cs_prepare_delete() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id into u from classstreak.users where auth_id=auth.uid();
 update classstreak.users set deletion_requested=true,tracking_consent=false,show_on_board=false,share_place_name=false where id=u;
 update classstreak.tracking_devices set active=false where user_id=u;
 delete from classstreak.visit_candidates where user_id=u;
 delete from classstreak.friendships where u in(user_a,user_b);
 return jsonb_build_object('prepared',true);
end $$;
revoke all on all functions in schema classstreak from public,anon,authenticated;
revoke all on function public.cs_health(jsonb),public.cs_prepare_delete() from public,anon;
grant execute on function public.cs_health(jsonb),public.cs_prepare_delete() to authenticated;
