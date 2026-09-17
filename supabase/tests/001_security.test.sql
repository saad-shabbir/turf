-- Run with `supabase test db` on a disposable local Supabase stack only.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(9);
select extensions.ok((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'),'Every exposed application table has RLS');
select extensions.ok(not has_table_privilege('anon','public.places','SELECT'),'anon has no private place grant');
select extensions.ok(not has_table_privilege('authenticated','public.geofence_events','INSERT'),'raw events require guarded RPC');
select extensions.ok(not has_table_privilege('authenticated','public.visits','UPDATE'),'derived visits read only');
select extensions.ok(not has_table_privilege('authenticated','private.allowed_users','SELECT'),'allowlist not exposed');
select extensions.ok(not has_function_privilege('anon','public.ingest_geofence_batch(jsonb,jsonb)','EXECUTE'),'anon cannot ingest');
select extensions.ok(not has_function_privilege('authenticated','private.replay(uuid,uuid)','EXECUTE'),'derivation cannot be called directly');
select extensions.ok(has_function_privilege('authenticated','public.ingest_geofence_batch(jsonb,jsonb)','EXECUTE'),'authenticated guarded ingestion granted');
select extensions.ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='one_live_pair'),'single live pair index exists');
select * from extensions.finish();
rollback;
