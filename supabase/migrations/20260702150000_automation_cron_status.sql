-- Expose whether the daily-reminder pg_cron job is scheduled, so the admin UI
-- can show "Schedule active". Readable by super admins (and the service role,
-- for deploy-time verification). Returns metadata only.
create or replace function public.automation_cron_status()
returns table (scheduled boolean, schedule text, active boolean)
language plpgsql
stable
security definer
set search_path = public, cron
as $$
begin
  -- super_admin via the app, or the service role (auth.uid() is null) at deploy time.
  if auth.uid() is not null and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden';
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    return query
      select true, j.schedule, j.active
      from cron.job j
      where j.jobname = 'vkm-daily-reminders'
      limit 1;
    if not found then
      return query select false, null::text, false;
    end if;
  else
    return query select false, null::text, false;
  end if;
end;
$$;

revoke all on function public.automation_cron_status() from anon, public;
grant execute on function public.automation_cron_status() to authenticated, service_role;
