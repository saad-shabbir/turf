create function private.replay(sid uuid,pid uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.tracking_sessions; p public.places; e public.geofence_events; opening public.geofence_events;
 outside_seen boolean:=false; known boolean; bad boolean; stream_bad boolean; last_seq bigint:=0; seconds bigint; reason text;
begin
 select * into s from public.tracking_sessions where id=sid;
 select * into p from public.places where id=pid;
 select exists(select 1 from (
   select client_seq,lag(client_seq) over(order by observed_at,client_seq,id) previous_seq
   from public.geofence_events where session_id=sid and place_id=pid and validation_status<>'rejected'
 ) ordered where client_seq<=previous_seq) into stream_bad;
 -- Retention cleanup must not replay a stream after its opening evidence expired.
 delete from public.visits where session_id=sid and place_id=pid and opening_event_id is not null;
 for e in select * from public.geofence_events where session_id=sid and place_id=pid order by observed_at,client_seq,id loop
 if e.validation_status='rejected' then continue; end if;
 if e.kind='ENTER' and opening.id is null then
 opening:=e; known:=outside_seen and not e.initial_state_possible;
 bad:=stream_bad or e.validation_status<>'valid' or e.client_seq<=last_seq;
 elsif e.kind='EXIT' then
 if opening.id is not null then
 seconds:=floor(extract(epoch from (e.observed_at-opening.observed_at)));
 bad:=bad or e.validation_status<>'valid' or e.client_seq<=opening.client_seq;
 reason:=case when not known then 'START_UNKNOWN' when bad then 'CLOCK_REVIEW'
 when seconds>case p.category when 'gym' then 14400 when 'mosque' then 21600 when 'work' then 57600 else 43200 end then 'LONG_VISIT' else null end;
 insert into public.visits(id,user_id,device_id,session_id,pair_id,place_id,category,opening_event_id,closing_event_id,stable_visit_key,observed_start_at,observed_end_at,dwell_seconds,status,start_known,quality_reason,created_at)
 values(opening.id,s.user_id,s.device_id,sid,s.pair_id,pid,p.category,opening.id,e.id,opening.id::text,case when known then opening.observed_at end,e.observed_at,case when reason is null then seconds end,case when reason is null then 'closed' else 'needs_review' end,known,reason,opening.received_at);
 opening:=null;
 end if;
 outside_seen:=true;
 end if;
 last_seq:=e.client_seq;
 end loop;
 if opening.id is not null then
 insert into public.visits(id,user_id,device_id,session_id,pair_id,place_id,category,opening_event_id,stable_visit_key,observed_start_at,status,start_known,quality_reason,created_at)
 values(opening.id,s.user_id,s.device_id,sid,s.pair_id,pid,p.category,opening.id,opening.id::text,case when known then opening.observed_at end,
 case when s.ended_at is not null then 'interrupted' when bad then 'needs_review' else 'open' end,known,
 case when s.ended_at is not null then s.end_reason when not known then 'START_UNKNOWN' when bad then 'CLOCK_REVIEW' end,opening.received_at);
 end if;
 -- Overlap is diagnostic ambiguity. Preserve intervals, clear usable duration.
 update public.visits v set status='needs_review',quality_reason='OVERLAP',dwell_seconds=null where v.user_id=s.user_id and v.session_id=sid and exists(
 select 1 from public.visits o where o.user_id=v.user_id and o.session_id=v.session_id and o.place_id<>v.place_id
 and o.observed_start_at is not null and v.observed_start_at is not null
 and tstzrange(o.observed_start_at,o.observed_end_at,'[)') && tstzrange(v.observed_start_at,v.observed_end_at,'[)'));
end $$;
create function public.ingest_geofence_batch(events jsonb,pending_session_closures jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); item jsonb; c jsonb; eid uuid; sid uuid; did uuid; pid uuid;
 s public.tracking_sessions; p public.places; prior public.geofence_events; obs timestamptz; seq bigint;
 accepted jsonb:='[]'; duplicates jsonb:='[]'; rejected jsonb:='[]'; why text; review boolean; g record;
begin
 if jsonb_typeof(events)<>'array' or jsonb_typeof(pending_session_closures)<>'array' or jsonb_array_length(events)>25 or jsonb_array_length(pending_session_closures)>25
 or octet_length(events::text)+octet_length(pending_session_closures::text)>65536 then raise exception 'INVALID_INPUT'; end if;
 for c in select value from jsonb_array_elements(pending_session_closures) loop
 perform public.end_capture((c->>'session_id')::uuid,(c->>'observed_end_at')::timestamptz,c->>'reason');
 end loop;
 for item in select value from jsonb_array_elements(events) loop
 why:=null;
 begin
 eid:=(item->>'event_id')::uuid; sid:=(item->>'session_id')::uuid; did:=(item->>'device_id')::uuid; pid:=(item->>'place_id')::uuid;
 obs:=(item->>'observed_at')::timestamptz; seq:=(item->>'client_seq')::bigint;
 if eid is null or sid is null or did is null or pid is null or obs is null or not isfinite(obs) or seq is null or seq<=0
 or item->>'kind' not in ('ENTER','EXIT') or coalesce(length(item->>'platform_event_id'),0) not between 1 and 200
 or jsonb_typeof(item->'initial_state_possible') is distinct from 'boolean' then raise invalid_parameter_value using message='INVALID_INPUT'; end if;
 select * into s from public.tracking_sessions where id=sid and user_id=u and device_id=did;
 select * into p from public.places where id=pid and user_id=u;
 if s.id is null or p.id is null then why:='NOT_OWNER';
 elsif not exists(select 1 from private.session_places where session_id=sid and place_id=pid) then why:='STALE_SESSION';
 elsif not exists(select 1 from public.devices where id=did and user_id=u and active) then why:='WRONG_DEVICE';
 elsif obs<now()-interval '30 days' then why:='RETENTION_EXPIRED';
 elsif obs<s.started_at or (s.ended_at is not null and obs>s.ended_at) or obs<p.created_at or (p.disabled_at is not null and obs>p.disabled_at) then why:='STALE_SESSION';
 end if;
 if why is null then
 select * into prior from public.geofence_events where id=eid or (device_id=did and (platform_event_id=item->>'platform_event_id' or client_seq=seq)) limit 1;
 if found then
 if prior.user_id=u and prior.id=eid and prior.session_id=sid and prior.place_id=pid and prior.device_id=did and prior.client_seq=seq and prior.platform_event_id=item->>'platform_event_id' and prior.kind=item->>'kind' and prior.observed_at=obs and prior.initial_state_possible=(item->>'initial_state_possible')::boolean then
 duplicates:=duplicates||jsonb_build_array(eid);
 else why:='ID_CONFLICT'; end if;
 else
 review:=obs>now()+interval '5 minutes';
 insert into public.geofence_events(id,user_id,device_id,session_id,place_id,platform_event_id,client_seq,kind,observed_at,initial_state_possible,validation_status,validation_reason)
 values(eid,u,did,sid,pid,item->>'platform_event_id',seq,item->>'kind',obs,(item->>'initial_state_possible')::boolean,case when review then 'review' else 'valid' end,case when review then 'CLOCK_REVIEW' end);
 accepted:=accepted||jsonb_build_array(eid);
 end if;
 end if;
 exception when invalid_parameter_value or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation then why:='INVALID_INPUT';
 end;
 if why is not null then rejected:=rejected||jsonb_build_array(jsonb_build_object('event_id',item->>'event_id','code',why)); end if;
 end loop;
 -- Replaying every retained group for this two-user app gives deterministic late
 -- uploads, including closure-only batches. No network-order pairing heuristic.
 for g in select distinct session_id,place_id from public.geofence_events where user_id=u loop perform private.replay(g.session_id,g.place_id); end loop;
 update public.devices set last_sync_at=now(),last_runtime_at=now() where user_id=u and active;
 perform public.cleanup_my_retention();
 return jsonb_build_object('accepted',accepted,'duplicates',duplicates,'rejected',rejected,'server_time',now());
end $$;
create function public.cleanup_my_retention() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.lock_actor(); begin
 update public.visits set quality_reason=coalesce(quality_reason,'RAW_RETAINED_UNTIL_30_DAYS') where user_id=u and opening_event_id in(select id from public.geofence_events where user_id=u and observed_at<now()-interval '30 days');
 delete from public.geofence_events where user_id=u and observed_at<now()-interval '30 days';
 delete from public.diagnostic_events where user_id=u and received_at<now()-interval '30 days';
 delete from public.visits where user_id=u and coalesce(observed_end_at,observed_start_at,created_at)<now()-interval '90 days';
 delete from private.invite_attempts where user_id=u and window_started_at<now()-interval '1 day';
 return jsonb_build_object('code','OK');
end $$;
-- Exact allowlist of exposed functions; internal helpers never callable as RPCs.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_allowed(),private.is_current_peer(uuid) to authenticated;
revoke all on function public.get_my_setup_state(),public.update_my_settings(jsonb),public.create_pair_invite(),public.join_pair(text),public.end_my_pair(),public.claim_device(uuid,jsonb),public.save_my_place(jsonb),public.disable_my_place(uuid),public.begin_capture(uuid),public.end_capture(uuid,timestamptz,text),public.record_my_diagnostic(text,text),public.delete_my_app_data(),public.ingest_geofence_batch(jsonb,jsonb),public.cleanup_my_retention() from public,anon,authenticated;
grant execute on function public.get_my_setup_state(),public.update_my_settings(jsonb),public.create_pair_invite(),public.join_pair(text),public.end_my_pair(),public.claim_device(uuid,jsonb),public.save_my_place(jsonb),public.disable_my_place(uuid),public.begin_capture(uuid),public.end_capture(uuid,timestamptz,text),public.record_my_diagnostic(text,text),public.delete_my_app_data(),public.ingest_geofence_batch(jsonb,jsonb),public.cleanup_my_retention() to authenticated;
