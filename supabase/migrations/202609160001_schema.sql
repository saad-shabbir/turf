create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create table private.allowed_users (
 slot smallint primary key check(slot in (1,2)),
 user_id uuid unique not null references auth.users on delete cascade,
 created_at timestamptz not null default now()
);
create function private.is_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.allowed_users where user_id=auth.uid())
$$;
create function private.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_allowed() then raise exception 'NOT_ALLOWLISTED'; end if;
 return auth.uid();
end $$;
create table public.profiles (
 user_id uuid primary key references auth.users on delete cascade,
 display_name text not null check(length(display_name) between 1 and 40),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_settings (
 user_id uuid primary key references auth.users on delete cascade,
 display_timezone text not null default 'America/Los_Angeles',
 collection_consent_at timestamptz,
 share_gym boolean not null default false, share_work boolean not null default false,
 share_mosque boolean not null default false, updated_at timestamptz not null default now()
);
create table public.pairs (
 id uuid primary key default extensions.gen_random_uuid(),
 user_a uuid not null references auth.users on delete cascade,
 user_b uuid references auth.users on delete cascade,
 status text not null check(status in ('pending','active','ended')),
 competition_timezone text not null default 'America/Los_Angeles',
 created_at timestamptz not null default now(), activated_at timestamptz, ended_at timestamptz,
 check(user_a<>user_b),
 check((status='pending' and user_b is null) or (status='active' and user_b is not null and activated_at is not null) or (status='ended' and ended_at is not null))
);
create unique index one_live_pair on public.pairs ((true)) where status in ('pending','active');
create table private.pair_invites (
 id uuid primary key default extensions.gen_random_uuid(), pair_id uuid not null references public.pairs on delete cascade,
 created_by uuid not null references auth.users on delete cascade, code_digest bytea unique not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null, consumed_at timestamptz
);
create table private.invite_attempts (
 user_id uuid not null references auth.users on delete cascade, window_started_at timestamptz not null,
 attempts integer not null check(attempts>=0), primary key(user_id,window_started_at)
);
create table public.devices (
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 installation_id uuid not null, active boolean not null default true, created_at timestamptz not null default now(),
 last_runtime_at timestamptz,last_sync_at timestamptz,app_version text not null,os_version text not null,
 unique(user_id,installation_id)
);
create unique index one_active_device on public.devices(user_id) where active;
create table public.places (
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 place_key uuid not null, revision integer not null check(revision>0), label text not null check(length(label) between 1 and 80),
 category text not null check(category in ('gym','work','mosque','home','custom')),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 radius_m integer not null check(radius_m between 75 and 400), min_dwell_seconds integer not null check(min_dwell_seconds between 0 and 86400),
 active boolean not null default true,created_at timestamptz not null default now(),disabled_at timestamptz,
 unique(user_id,place_key,revision)
);
create unique index one_active_revision on public.places(user_id,place_key) where active;
create table public.tracking_sessions (
 id uuid primary key default extensions.gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 device_id uuid not null references public.devices on delete cascade,pair_id uuid references public.pairs on delete set null,
 generation bigint not null,started_at timestamptz not null default now(),ended_at timestamptz,
 end_reason text check(end_reason in ('paused','logout','place_change','unpaired','replaced_device','deleted_data')),
 created_at timestamptz not null default now(),unique(device_id,generation),check(ended_at>=started_at)
);
create unique index one_active_session on public.tracking_sessions(device_id) where ended_at is null;
create table private.session_places (
 session_id uuid not null references public.tracking_sessions on delete cascade,
 place_id uuid not null references public.places on delete cascade,
 primary key(session_id,place_id)
);
create table public.geofence_events (
 id uuid primary key,user_id uuid not null references auth.users on delete cascade,
 device_id uuid not null references public.devices on delete cascade,session_id uuid not null references public.tracking_sessions on delete cascade,
 place_id uuid not null references public.places on delete cascade,platform_event_id text not null check(length(platform_event_id) between 1 and 200),
 client_seq bigint not null check(client_seq>0),kind text not null check(kind in ('ENTER','EXIT')),
 observed_at timestamptz not null,received_at timestamptz not null default now(),initial_state_possible boolean not null,
 validation_status text not null,validation_reason text,
 unique(device_id,platform_event_id),unique(device_id,client_seq)
);
create table public.visits (
 id uuid primary key,user_id uuid not null references auth.users on delete cascade,
 device_id uuid not null references public.devices on delete cascade,session_id uuid not null references public.tracking_sessions on delete cascade,
 pair_id uuid references public.pairs on delete set null,place_id uuid not null references public.places on delete cascade,
 category text not null,opening_event_id uuid references public.geofence_events on delete set null,
 closing_event_id uuid references public.geofence_events on delete set null,stable_visit_key text not null,
 observed_start_at timestamptz,observed_end_at timestamptz,dwell_seconds integer check(dwell_seconds>=0),
 status text not null check(status in ('open','closed','interrupted','needs_review','rejected')),
 start_known boolean not null,quality_reason text,derived_version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,stable_visit_key)
);
create table public.diagnostic_events (
 id uuid primary key default extensions.gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 device_id uuid references public.devices on delete set null,session_id uuid references public.tracking_sessions on delete set null,
 code text not null,detail_safe text,observed_at timestamptz not null default now(),received_at timestamptz not null default now()
);
create function private.is_current_peer(target_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_allowed() and exists(select 1 from public.pairs p where p.status='active' and
 ((p.user_a=auth.uid() and p.user_b=target_user_id) or (p.user_b=auth.uid() and p.user_a=target_user_id)))
$$;
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','devices','places','tracking_sessions','geofence_events','visits','diagnostic_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid() and private.is_allowed())',t);
 end loop;
end $$;
create policy safe_peer on public.profiles for select to authenticated using(private.is_current_peer(user_id));
alter table public.pairs enable row level security;
revoke all on public.pairs from public,anon,authenticated;
grant select on public.pairs to authenticated;
create policy participant on public.pairs for select to authenticated using(private.is_allowed() and (user_a=auth.uid() or user_b=auth.uid()));
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_allowed(),private.is_current_peer(uuid) to authenticated;
