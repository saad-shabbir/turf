-- Run after inspecting existing cron jobs. pg_cron is available on hosted Supabase.
create extension if not exists pg_cron;
do $$ declare existing bigint;begin
 select jobid into existing from cron.job where jobname='classstreak-maintenance';
 if existing is not null then perform cron.unschedule(existing);end if;
 perform cron.schedule('classstreak-maintenance','*/15 * * * *','select classstreak.maintenance()');
end $$;
