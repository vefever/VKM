-- Notification history drops from 30 days to 7.
--
-- Notifications are transient UI signals ("habit proof approved", "new
-- message") — the underlying record they point at always outlives them, so a
-- short window costs nothing and keeps the largest table small. At the time of
-- writing this removes 1,050 of 1,373 rows.
--
-- Everything else in the prune keeps its existing window.
CREATE OR REPLACE FUNCTION public.prune_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  delete from public.email_log            where created_at < now() - interval '30 days';
  delete from public.whatsapp_log         where created_at < now() - interval '30 days';
  delete from public.reminder_log         where created_at < now() - interval '30 days';
  delete from public.otp_requests         where created_at < now() - interval '1 day';
  delete from public.mfa_email_challenges where expires_at < now();
  -- 7 days: read or not, a week-old in-app notification has been overtaken by
  -- the thing it was announcing.
  delete from public.notifications        where created_at < now() - interval '7 days';
  -- One row per 250 ml tap, kept only as an audit trail: daily_water holds the
  -- running total the UI actually reads, so old events are safe to drop.
  delete from public.water_events         where created_at < now() - interval '30 days';
end;
$$;
REVOKE ALL ON FUNCTION public.prune_old_logs() FROM anon, authenticated;

-- Apply immediately rather than waiting for Sunday's cron.
SELECT public.prune_old_logs();
ANALYZE public.notifications;
