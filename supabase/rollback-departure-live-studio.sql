-- Emergency rollback only. Review and coordinate with the app release first.
-- Keeps all records and the new functions; restores the prior ingest behavior.
begin;
do $$declare definition text;begin
 if to_regprocedure('public.cs_ingest_before_departure_recovery(jsonb,uuid)') is null then raise exception 'No verified rollback exists';end if;
 definition:=pg_get_functiondef('public.cs_ingest_before_departure_recovery(jsonb,uuid)'::regprocedure);
 execute replace(definition,'FUNCTION public.cs_ingest_before_departure_recovery(','FUNCTION public.cs_ingest(');
end $$;
-- cs_studio_live is read-only and can safely remain available to the new app.
-- Keep the broader 0–7 goal constraint. Tightening it could reject or destroy
-- valid goals saved after release; no user preferences are clamped on rollback.
commit;
