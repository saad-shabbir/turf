-- All state mutations serialize on this application's two-user lock. This also
-- prevents replay racing pause, deletion, revision replacement and pair changes.
create function private.lock_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid; begin u:=private.actor(); perform pg_catalog.pg_advisory_xact_lock(740016); return u; end $$;
create function private.interrupt_sessions(u uuid, why text) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.tracking_sessions set ended_at=now(),end_reason=why where user_id=u and ended_at is null;
 update public.visits set status='interrupted',dwell_seconds=null,quality_reason=why,updated_at=now() where user_id=u and status='open';
end $$;
create function public.get_my_setup_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where user_id=u),
 'settings',(select to_jsonb(s) from public.user_settings s where user_id=u),
 'pair',(select to_jsonb(p) from public.pairs p where status in ('pending','active') and u in (user_a,user_b)),
 'device',(select to_jsonb(d) from public.devices d where user_id=u and active));
end $$;
create function public.update_my_settings(patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); tz text; begin
 if exists(select 1 from jsonb_object_keys(patch) k where k not in ('display_name','display_timezone','collection_consent','share_gym','share_work','share_mosque')) then raise exception 'INVALID_INPUT'; end if;
 tz:=coalesce(patch->>'display_timezone',(select display_timezone from public.user_settings where user_id=u));
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'INVALID_INPUT'; end if;
 if patch ? 'display_name' then update public.profiles set display_name=patch->>'display_name',updated_at=now() where user_id=u; end if;
 update public.user_settings set display_timezone=tz,
 collection_consent_at=case when not (patch ? 'collection_consent') then collection_consent_at when (patch->>'collection_consent')::boolean then coalesce(collection_consent_at,now()) else null end,
 share_gym=coalesce((patch->>'share_gym')::boolean,share_gym),share_work=coalesce((patch->>'share_work')::boolean,share_work),share_mosque=coalesce((patch->>'share_mosque')::boolean,share_mosque),updated_at=now() where user_id=u;
 if patch->>'collection_consent'='false' then perform private.interrupt_sessions(u,'paused'); end if;
 return public.get_my_setup_state();
end $$;
create function public.create_pair_invite() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); p public.pairs; code text; begin
 select * into p from public.pairs where status in ('pending','active') for update;
 if found and (p.status='active' or p.user_a<>u) then return jsonb_build_object('code','PAIR_ALREADY_EXISTS'); end if;
 if p.id is null then insert into public.pairs(user_a,status) values(u,'pending') returning * into p; end if;
 delete from private.pair_invites where pair_id=p.id;
 -- Six unbiased hexadecimal symbols, 24 bits, plus persisted account limiter.
 code:=upper(encode(extensions.gen_random_bytes(3),'hex'));
 insert into private.pair_invites(pair_id,created_by,code_digest,expires_at) values(p.id,u,extensions.digest(code,'sha256'),now()+interval '24 hours');
 return jsonb_build_object('invite_code',code,'expires_at',now()+interval '24 hours');
end $$;
create function public.join_pair(code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); inv private.pair_invites; p public.pairs; n integer; w timestamptz; begin
 w:=to_timestamp(floor(extract(epoch from now())/900)*900);
 insert into private.invite_attempts values(u,w,1) on conflict(user_id,window_started_at) do update set attempts=private.invite_attempts.attempts+1 returning attempts into n;
 if n>5 then return jsonb_build_object('code','RATE_LIMITED'); end if;
 select * into inv from private.pair_invites where code_digest=extensions.digest(upper(trim(code)),'sha256') and consumed_at is null and expires_at>now() for update;
 if not found or inv.created_by=u then return jsonb_build_object('code','INVALID_OR_EXPIRED_CODE'); end if;
 select * into p from public.pairs where id=inv.pair_id for update;
 if p.status<>'pending' or not exists(select 1 from private.allowed_users where user_id=p.user_a) then return jsonb_build_object('code','INVALID_OR_EXPIRED_CODE'); end if;
 update public.pairs set user_b=u,status='active',activated_at=now() where id=p.id;
 update private.pair_invites set consumed_at=now() where id=inv.id;
 return jsonb_build_object('code','OK','pair_id',p.id);
end $$;
create function public.end_my_pair() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); p public.pairs; begin
 select * into p from public.pairs where status in ('pending','active') and u in (user_a,user_b) for update;
 if found then
 update public.pairs set status='ended',ended_at=now() where id=p.id;
 delete from private.pair_invites where pair_id=p.id;
 perform private.interrupt_sessions(p.user_a,'unpaired'); perform private.interrupt_sessions(p.user_b,'unpaired');
 end if;
 return jsonb_build_object('code','OK');
end $$;
create function public.claim_device(installation_id uuid,version_info jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); d public.devices; begin
 if length(version_info->>'app')>40 or length(version_info->>'os')>80 then raise exception 'INVALID_INPUT'; end if;
 select * into d from public.devices where user_id=u and devices.installation_id=claim_device.installation_id and active;
 if found then return to_jsonb(d); end if;
 perform private.interrupt_sessions(u,'replaced_device');
 update public.devices set active=false where user_id=u;
 insert into public.devices(user_id,installation_id,app_version,os_version) values(u,installation_id,version_info->>'app',version_info->>'os')
 on conflict on constraint devices_user_id_installation_id_key do update set active=true,app_version=excluded.app_version,os_version=excluded.os_version returning * into d;
 return to_jsonb(d);
end $$;
create function public.save_my_place(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); k uuid; r integer; p public.places; begin
 k:=coalesce((input->>'place_key')::uuid,extensions.gen_random_uuid());
 if input ? 'place_key' and not exists(select 1 from public.places where user_id=u and place_key=k) then raise exception 'NOT_OWNER'; end if;
 select coalesce(max(revision),0)+1 into r from public.places where user_id=u and place_key=k;
 update public.places set active=false,disabled_at=now() where user_id=u and place_key=k and active;
 if (select count(*) from public.places where user_id=u and active)>=10 then raise exception 'PLACE_LIMIT'; end if;
 perform private.interrupt_sessions(u,'place_change');
 insert into public.places(user_id,place_key,revision,label,category,latitude,longitude,radius_m,min_dwell_seconds)
 values(u,k,r,input->>'label',input->>'category',(input->>'latitude')::double precision,(input->>'longitude')::double precision,(input->>'radius_m')::integer,
 case input->>'category' when 'gym' then 1500 when 'work' then 1200 when 'mosque' then 900 when 'home' then 0 else 600 end) returning * into p;
 return to_jsonb(p);
end $$;
create function public.disable_my_place(place_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); begin
 if not exists(select 1 from public.places where id=place_id and user_id=u) then raise exception 'NOT_OWNER'; end if;
 perform private.interrupt_sessions(u,'place_change');
 update public.places set active=false,disabled_at=now() where id=place_id;
 return jsonb_build_object('code','OK');
end $$;
create function public.begin_capture(device_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); p uuid; s public.tracking_sessions; begin
 if not exists(select 1 from public.devices where id=device_id and user_id=u and active) then raise exception 'WRONG_DEVICE'; end if;
 select id into p from public.pairs where status='active' and u in (user_a,user_b);
 if p is null then raise exception 'PAIR_REQUIRED'; end if;
 if not exists(select 1 from public.user_settings where user_id=u and collection_consent_at is not null) then raise exception 'CONSENT_REQUIRED'; end if;
 if not exists(select 1 from public.places where user_id=u and active) then raise exception 'PLACE_REQUIRED'; end if;
 perform private.interrupt_sessions(u,'paused');
 insert into public.tracking_sessions(user_id,device_id,pair_id,generation)
 values(u,device_id,p,1+(select coalesce(max(generation),0) from public.tracking_sessions where tracking_sessions.device_id=begin_capture.device_id)) returning * into s;
 insert into private.session_places(session_id,place_id) select s.id,id from public.places where user_id=u and active;
 return to_jsonb(s);
end $$;
create function public.end_capture(session_id uuid,observed_end_at timestamptz,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); s public.tracking_sessions; begin
 select * into s from public.tracking_sessions where id=session_id and user_id=u for update;
 if not found then raise exception 'NOT_OWNER'; end if;
 if reason not in ('paused','logout','place_change','unpaired','replaced_device','deleted_data') or observed_end_at<s.started_at or observed_end_at>now()+interval '5 minutes' then raise exception 'INVALID_INPUT'; end if;
 update public.tracking_sessions set ended_at=least(coalesce(ended_at,observed_end_at),observed_end_at),end_reason=coalesce(end_reason,reason) where id=s.id;
 -- Late closure invalidates any event already uploaded beyond the stop boundary.
 update public.geofence_events set validation_status='rejected',validation_reason='STALE_SESSION' where geofence_events.session_id=s.id and observed_at>observed_end_at;
 update public.visits set status='interrupted',dwell_seconds=null,quality_reason=reason,updated_at=now() where visits.session_id=s.id and (status='open' or visits.observed_end_at> end_capture.observed_end_at);
 return jsonb_build_object('code','OK');
end $$;
create function public.record_my_diagnostic(code text,safe_detail text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if code not in ('AUTH_REQUIRED','STORAGE_ERROR','TASK_ERROR','UPLOAD_ERROR','PERMISSION_REQUIRED','REGISTRATION_ERROR','RETENTION_WARNING') or safe_detail is not null then raise exception 'INVALID_INPUT'; end if;
 insert into public.diagnostic_events(user_id,code) values(u,code);
 return jsonb_build_object('code','OK');
end $$;
create function public.delete_my_app_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); begin
 perform public.end_my_pair(); perform private.interrupt_sessions(u,'deleted_data');
 delete from public.visits where user_id=u; delete from public.geofence_events where user_id=u;
 delete from public.diagnostic_events where user_id=u; delete from public.tracking_sessions where user_id=u;
 delete from public.devices where user_id=u; delete from public.places where user_id=u;
 delete from public.user_settings where user_id=u; delete from public.profiles where user_id=u;
 delete from private.invite_attempts where user_id=u; delete from private.pair_invites where created_by=u;
 -- Historical pair membership is app data too; SET NULL preserves the peer's history.
 delete from public.pairs where u in(user_a,user_b);
 return jsonb_build_object('code','DELETED','auth_account_deleted',false);
end $$;
