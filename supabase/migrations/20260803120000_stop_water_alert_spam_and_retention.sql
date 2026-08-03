-- =========================================================
-- Stop the "Rapid water logging" notification flood + add log retention.
--
-- The water_events rapid-logging trigger fired an ALERT to every coach + mentor
-- + admin (~7 rows) each time a participant logged water within 30 min — which
-- is normal behaviour when drinking toward a 4L goal. It produced ~80% of ALL
-- notifications (3,779 rows), burying the useful ones. The signal is redundant:
-- staff already see "Rapid water logging (N× in 24h)" in the coach cohort
-- at-risk view, and each glass is ⚠-flagged in the water timeline. So we drop
-- the notification (the `rapid` flag on water_events stays — the at-risk view is
-- unaffected).
-- =========================================================

drop trigger if exists water_events_rapid_notify on public.water_events;
drop function if exists public.notify_rapid_water();

-- ---------------------------------------------------------
-- Automatic log/notification retention so nothing piles up again.
-- Runs weekly (Sunday 19:00 UTC). Deletes:
--   • message/delivery logs      older than 30 days
--   • otp rate-limit buckets     older than 1 day
--   • expired MFA challenges
--   • notifications              older than 30 days (read or not — the
--     underlying record lives in its own table; this only clears stale alerts)
-- ---------------------------------------------------------
create or replace function public.prune_old_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.email_log            where created_at < now() - interval '30 days';
  delete from public.whatsapp_log         where created_at < now() - interval '30 days';
  delete from public.reminder_log         where created_at < now() - interval '30 days';
  delete from public.otp_requests         where created_at < now() - interval '1 day';
  delete from public.mfa_email_challenges where expires_at < now();
  delete from public.notifications        where created_at < now() - interval '30 days';
end;
$$;
revoke all on function public.prune_old_logs() from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'vkm-prune-logs') then
      perform cron.unschedule('vkm-prune-logs');
    end if;
    perform cron.schedule('vkm-prune-logs', '0 19 * * 0', $cmd$ select public.prune_old_logs(); $cmd$);
  end if;
end $$;
