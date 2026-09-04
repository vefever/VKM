-- Notification retention becomes read-aware.
--
-- A flat 7-day window also deleted notifications the participant had never
-- opened — someone away from the app for a week came back to nothing. Read
-- notifications have served their purpose and go at 7 days; unread ones are held
-- to 30 so they survive a holiday or a quiet fortnight.
--
-- Nothing else in the prune changes.
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

  -- Seen it: gone after a week.
  delete from public.notifications
    where created_at < now() - interval '7 days'
      and read = true;
  -- Never seen it: held to 30 days, then dropped regardless — by then whatever
  -- it announced has long since been overtaken.
  delete from public.notifications
    where created_at < now() - interval '30 days';

  -- One row per 250 ml tap, kept only as an audit trail: daily_water holds the
  -- running total the UI actually reads, so old events are safe to drop.
  delete from public.water_events         where created_at < now() - interval '30 days';
end;
$$;
REVOKE ALL ON FUNCTION public.prune_old_logs() FROM anon, authenticated;

-- Partial index so the read-aware delete (and the unread badge count) stay cheap
-- as the table refills.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

SELECT public.prune_old_logs();
ANALYZE public.notifications;
