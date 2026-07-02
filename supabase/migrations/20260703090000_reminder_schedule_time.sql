-- =========================================================
-- CONFIGURABLE REMINDER TIME (2026-07-03)
--
-- The daily-reminder pg_cron job was hardcoded to 20:00 IST. Let super admins
-- pick their own send time. `set_reminder_schedule(hour, minute)` persists the
-- chosen IST time in the automation config AND re-writes the pg_cron job to the
-- equivalent UTC time. IST = UTC + 5:30, so UTC minutes = (IST − 330) mod 1440.
-- =========================================================

-- Seed the current time (20:00 IST) into config so the UI has a value to show.
update public.messaging_settings
set config = config || jsonb_build_object(
      'send_hour_ist', coalesce(nullif(config->>'send_hour_ist','')::int, 20),
      'send_minute_ist', coalesce(nullif(config->>'send_minute_ist','')::int, 0)
    )
where id = 'automation';

create or replace function public.set_reminder_schedule(_hour int, _minute int)
returns table (scheduled boolean, schedule text, active boolean)
language plpgsql
security definer
set search_path = public, cron
as $func$
declare
  ist_total int;
  utc_total int;
  uh int;
  um int;
  cron_expr text;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden';
  end if;
  if _hour is null or _minute is null or _hour < 0 or _hour > 23 or _minute < 0 or _minute > 59 then
    raise exception 'Invalid time';
  end if;

  -- Persist the chosen IST time.
  update public.messaging_settings
  set config = config || jsonb_build_object('send_hour_ist', _hour, 'send_minute_ist', _minute),
      updated_at = now()
  where id = 'automation';

  -- IST → UTC.
  ist_total := _hour * 60 + _minute;
  utc_total := ((ist_total - 330) % 1440 + 1440) % 1440;
  uh := utc_total / 60;
  um := utc_total % 60;
  cron_expr := um::text || ' ' || uh::text || ' * * *';

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'vkm-daily-reminders') then
      perform cron.unschedule('vkm-daily-reminders');
    end if;
    perform cron.schedule(
      'vkm-daily-reminders',
      cron_expr,
      $cmd$
      select net.http_post(
        url := 'https://ehsbzxrekrhmmpvbxlfv.supabase.co/functions/v1/messaging',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select config->>'cron_secret' from public.messaging_settings where id = 'automation')
        ),
        body := jsonb_build_object('action', 'run_reminders')
      );
      $cmd$
    );
    return query select true, cron_expr, true;
  else
    return query select false, cron_expr, false;
  end if;
end;
$func$;

revoke all on function public.set_reminder_schedule(int, int) from anon, public;
grant execute on function public.set_reminder_schedule(int, int) to authenticated, service_role;
