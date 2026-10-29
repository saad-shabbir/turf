-- Run once, after migration 202610280018, from the SQL editor of the "turf" project.
-- 1. Every 5 minutes: missed-plan alerts and closing forgotten workout timers.
create extension if not exists pg_cron;
do $$ declare existing bigint;begin
 select jobid into existing from cron.job where jobname='classstreak-social';
 if existing is not null then perform cron.unschedule(existing);end if;
 perform cron.schedule('classstreak-social','*/5 * * * *','select classstreak.social_checks()');
end $$;
-- 2. Only after a build with the push entitlement is on TestFlight and the
--    send_push Edge Function is deployed (--no-verify-jwt). Needs pg_net.
-- create extension if not exists pg_net;
-- update classstreak.push_config set enabled=true,endpoint='https://qrehonivhqcgfrjcpzqk.supabase.co/functions/v1/send_push';
-- do $$ declare existing bigint;begin
--  select jobid into existing from cron.job where jobname='classstreak-push';
--  if existing is not null then perform cron.unschedule(existing);end if;
--  perform cron.schedule('classstreak-push','* * * * *','select classstreak.dispatch_push()');
-- end $$;
