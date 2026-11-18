-- =====================================================================
-- SwapSpot · 06 · Scheduled jobs (pg_cron)
--
--   swapspot-tick    every minute   release finished bookings, move the simulated sensors
--   swapspot-prune   once a day     keep 60 days of sensor history, 2 days of job logs
--
-- cron uses UTC: 20:15 UTC = 03:15 in Bangkok.
-- =====================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'swapspot-tick',
  '* * * * *',
  $$select private.housekeeping(); select private.sensor_tick();$$
);

select cron.schedule(
  'swapspot-prune',
  '15 20 * * *',
  $$delete from public.availability_snapshots where recorded_at < now() - interval '60 days';
    delete from cron.job_run_details where end_time < now() - interval '2 days';$$
);
