-- Update notifications. After an over-the-air update is published, every phone
-- on that runtime can get one push ("A new version of ClassStreak is ready.
-- Tap to update."), and tapping it applies the update in the app.
--
-- Each push token now records the app's runtime version, and an outbox row can
-- target one phone. Run as postgres (Management API) after `eas update`:
--   select classstreak.announce_update('<runtime>','ClassStreak update','<what changed>. Tap to update.');
-- Pushes still go out only when push sending is on (classstreak.push_config).
--
-- Rollback: revoke execute on classstreak.announce_update(text,text,text) from
-- service_role. The new columns are harmless; old clients keep working because
-- the new cs_push_token argument has a default.

alter table classstreak.push_tokens add column runtime_version text
 check(runtime_version is null or runtime_version ~ '^[A-Za-z0-9._:+-]{1,100}$');
create index on classstreak.push_tokens(runtime_version);
-- Null: every phone of the person (all earlier pushes). Set: only that phone.
alter table classstreak.push_outbox add column token text;

-- Same as 202610280018 plus the optional runtime version. A re-registration
-- that does not send one (an older app) keeps the runtime already on file.
drop function public.cs_push_token(text,boolean);
create function public.cs_push_token(push_token text,enabled boolean default true,runtime_version text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();v text:=nullif(btrim(cs_push_token.runtime_version),'');begin
 if u is null then raise exception 'SETUP_REQUIRED';end if;
 if not enabled then delete from classstreak.push_tokens t where t.token=push_token and t.user_id=u;return jsonb_build_object('registered',false);end if;
 if push_token is null or push_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'INVALID_TOKEN';end if;
 if v is not null and v !~ '^[A-Za-z0-9._:+-]{1,100}$' then raise exception 'INVALID_RUNTIME';end if;
 perform classstreak.throttle(u,'push_token',50);
 -- A phone that signs into another account moves its token with it.
 insert into classstreak.push_tokens(token,user_id,runtime_version) values(push_token,u,v)
 on conflict on constraint push_tokens_pkey do update set user_id=u,updated_at=now(),runtime_version=coalesce(excluded.runtime_version,push_tokens.runtime_version);
 delete from classstreak.push_tokens t where t.user_id=u and t.token not in(select x.token from classstreak.push_tokens x where x.user_id=u order by x.updated_at desc limit 5);
 return jsonb_build_object('registered',true);
end $$;
revoke all on function public.cs_push_token(text,boolean,text) from public,anon;
grant execute on function public.cs_push_token(text,boolean,text) to authenticated;

-- Same as 202610280018, except a row with a token goes to that phone only.
create or replace function public.cs_push_claim(max_items integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 delete from classstreak.push_outbox where sent_at is null and created_at<now()-interval '1 day';
 delete from classstreak.push_outbox where sent_at<now()-interval '7 days';
 with due as(
  select id from classstreak.push_outbox where sent_at is null and send_after<=now() and attempts<5 and (claimed_at is null or claimed_at<now()-interval '10 minutes')
  order by id limit least(greatest(coalesce(max_items,100),1),500) for update skip locked
 ),claimed as(
  update classstreak.push_outbox o set claimed_at=now(),attempts=o.attempts+1 from due where o.id=due.id returning o.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'body',c.body,'data',c.data,
   'tokens',(select coalesce(jsonb_agg(t.token),'[]') from classstreak.push_tokens t where t.user_id=c.user_id and (c.token is null or t.token=c.token)))),'[]') into result from claimed c;
 return result;
end $$;
revoke all on function public.cs_push_claim(integer) from public,anon,authenticated;

-- One push per phone on the runtime (every phone when runtime is null), for
-- people with "App updates" on. Quiet hours hold it until 7:00 local time. No
-- inbox item: the app shows its own banner. Announcing again replaces a push
-- that has not gone out yet. Returns how many pushes were queued.
create function classstreak.announce_update(runtime text,title text,body text) returns integer language plpgsql security definer set search_path='' as $$
declare r text:=nullif(btrim(announce_update.runtime),'');t_title text:=left(btrim(coalesce(announce_update.title,'')),80);t_body text:=left(btrim(coalesce(announce_update.body,'')),240);n integer;begin
 if t_title='' or t_body='' then raise exception 'TITLE_AND_BODY_REQUIRED';end if;
 delete from classstreak.push_outbox o where o.kind='app_update' and o.sent_at is null
  and o.token in(select t.token from classstreak.push_tokens t where r is null or t.runtime_version=r);
 insert into classstreak.push_outbox(user_id,kind,title,body,data,send_after,token)
 select t.user_id,'app_update',t_title,t_body,jsonb_build_object('type','app_update','kind','app_update'),coalesce(classstreak.quiet_until(u.tz),now()),t.token
 from classstreak.push_tokens t join classstreak.users u on u.id=t.user_id
 where not u.is_demo and u.notification_preferences->>'app_update' is distinct from 'false'
  and (r is null or t.runtime_version=r);
 get diagnostics n=row_count;
 perform classstreak.dispatch_push();
 return n;
end $$;
revoke all on function classstreak.announce_update(text,text,text) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 grant execute on function classstreak.announce_update(text,text,text) to service_role;end if;end $$;
