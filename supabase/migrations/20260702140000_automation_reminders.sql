-- =========================================================
-- WORKFLOW / AUTOMATION — DAILY TASK REMINDERS (2026-07-02)
--
-- A daily job (20:00 IST) emails + WhatsApps every ACTIVE participant who has
-- not completed all 6 of today's habits, nudging them to finish. Config lives
-- in messaging_settings(id='automation'); the `messaging` edge function does the
-- sending (reusing sendEmail / sendWhatsapp). This migration adds:
--   1. the automation config row (+ a cron shared-secret),
--   2. reminder_targets() — who to remind for a given IST date,
--   3. reminder_log — idempotency + an admin "last run" view,
--   4. a pg_cron schedule that POSTs the edge function at 14:30 UTC (= 20:00 IST).
-- =========================================================

-- ---------------------------------------------------------
-- 1. Automation config (single row in the existing settings table).
--    cron_secret authenticates the scheduled call to the edge function.
-- ---------------------------------------------------------
insert into public.messaging_settings (id, provider, enabled, config)
values (
  'automation', null, true,
  jsonb_build_object(
    'daily_reminders_enabled', false,          -- master switch (off until an admin turns it on)
    'email_enabled', true,
    'whatsapp_enabled', false,
    'email_subject', 'Finish today''s tasks ⏰',
    'email_heading', 'Keep your streak alive',
    'email_intro', 'You still have tasks left for today. A few focused minutes now keeps your momentum going strong.',
    'whatsapp_message', 'Hi {name}! ⏰ You still have {remaining} of 6 daily tasks left today. Finish them now to keep your streak going: https://vkmentorship.com/participant/habits',
    'cron_secret', replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
  )
)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 2. reminder_targets(_target date) — active participants who have NOT completed
--    all 6 habits for _target (a calendar date, matched against habit_logs.log_date
--    which is stored as the participant's IST day). Returns contact info + how many
--    of the 6 they've done. SECURITY DEFINER so it can read auth.users.email.
-- ---------------------------------------------------------
create or replace function public.reminder_targets(_target date)
returns table (user_id uuid, full_name text, email text, phone text, done int)
language sql
stable
security definer
set search_path = public
as $$
  with active as (
    select distinct pe.user_id
    from public.program_enrollments pe
    join public.user_roles ur on ur.user_id = pe.user_id and ur.role = 'participant'
    join public.profiles pr on pr.id = pe.user_id
    where pe.status = 'active'
      and pe.started_at is not null
      and coalesce(pr.is_alumni, false) = false
      and exists (
        select 1 from public.batch_members bm
        join public.batches b on b.id = bm.batch_id
        where bm.user_id = pe.user_id
          and bm.role = 'participant'
          and b.status not in ('completed', 'archived')
      )
  ),
  done as (
    select hl.user_id, count(distinct hl.habit_id)::int as c
    from public.habit_logs hl
    where hl.log_date = _target
    group by hl.user_id
  )
  select a.user_id,
         coalesce(nullif(btrim(pr.full_name), ''), 'there') as full_name,
         au.email,
         pr.phone,
         coalesce(d.c, 0) as done
  from active a
  join public.profiles pr on pr.id = a.user_id
  join auth.users au on au.id = a.user_id
  left join done d on d.user_id = a.user_id
  where coalesce(d.c, 0) < 6;
$$;

revoke all on function public.reminder_targets(date) from anon, authenticated, public;
grant execute on function public.reminder_targets(date) to service_role;

-- ---------------------------------------------------------
-- 3. reminder_log — one row per (participant, date, channel); makes re-runs
--    idempotent and powers the admin "last run" summary.
-- ---------------------------------------------------------
create table if not exists public.reminder_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  target_date date not null,
  channel text not null,        -- 'email' | 'whatsapp'
  status text not null,         -- 'sent' | 'failed' | 'skipped'
  detail text,
  created_at timestamptz not null default now(),
  unique (user_id, target_date, channel)
);
create index if not exists reminder_log_date on public.reminder_log (target_date desc);

alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon;
grant select on public.reminder_log to authenticated;   -- gated by policy below
grant all on public.reminder_log to service_role;

drop policy if exists reminder_log_staff_read on public.reminder_log;
create policy reminder_log_staff_read on public.reminder_log
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------
-- 4. Schedule: POST the edge function every day at 14:30 UTC (= 20:00 IST).
--    Best-effort — if pg_cron/pg_net aren't available the rest of the migration
--    still applies and the job can be scheduled from the dashboard later.
-- ---------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
exception when others then
  raise notice 'reminder schedule: cron extensions unavailable (%). Enable pg_cron + pg_net, then re-run the schedule block.', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'vkm-daily-reminders') then
      perform cron.unschedule('vkm-daily-reminders');
    end if;
    perform cron.schedule(
      'vkm-daily-reminders',
      '30 14 * * *',
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
  end if;
end $$;
