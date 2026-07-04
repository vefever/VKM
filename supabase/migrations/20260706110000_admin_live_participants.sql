-- =========================================================
-- ADMIN LIVE PARTICIPANTS (2026-07-06)
--
-- One efficient round trip powering the Super Admin System Overview command
-- center: per-participant live status (today's habits, liveness/last-seen,
-- at-risk, open tickets, progress, revenue), optionally scoped to one batch.
-- The KPI tiles on the dashboard are derived client-side from these rows, so
-- this single RPC is the data spine for both the tracker and the KPIs.
--
-- Composes formulas that already live in coach_cohort_overview (progress,
-- mrr, habit_active_3d, focus/actions) + admin_analytics_overview (current
-- week, today's habit count, at-risk, active-15m). Super-admin only — pure
-- SQL guard (returns empty for anyone else), matching admin_people_search.
-- =========================================================

create or replace function public.admin_live_participants(_batch_id uuid default null)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  business_name text,
  batch_id uuid,
  batch_name text,
  batch_status text,
  started_at timestamptz,
  total_weeks int,
  current_week int,
  enroll_status text,
  points bigint,
  weeks_approved bigint,
  pending_proofs bigint,
  last_proof_at timestamptz,
  habits_done_today int,
  focus_minutes_today bigint,
  actions_done bigint,
  actions_total bigint,
  water_pct_today int,
  open_tickets bigint,
  habit_active_3d boolean,
  last_active_at timestamptz,
  is_online_15m boolean,
  at_risk boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with parts as (
    -- One row per participant, carrying their (first) batch — same shape as
    -- coach_cohort_overview, but org-wide and optionally filtered to a batch.
    select distinct on (ur.user_id) ur.user_id, bm.batch_id
    from user_roles ur
    left join batch_members bm on bm.user_id = ur.user_id and bm.role = 'participant'
    where ur.role = 'participant'
      and public.has_role(auth.uid(), 'super_admin')          -- guard: empty for non-admins
      and (_batch_id is null or bm.batch_id = _batch_id)
    order by ur.user_id, bm.batch_id
  )
  select
    pr.id as user_id,
    pr.full_name,
    pr.avatar_url,
    bb.business_name,
    parts.batch_id,
    b.name as batch_name,
    b.status as batch_status,
    pe.started_at,
    coalesce(pe.total_weeks, 16) as total_weeks,
    case
      when pe.started_at is null then 0
      else least(coalesce(pe.total_weeks, 16),
                 greatest(1, floor((current_date - pe.started_at::date) / 7) + 1))::int
    end as current_week,
    coalesce(pe.status, 'not_started') as enroll_status,
    coalesce((select sum(pl.points) from points_ledger pl where pl.user_id = pr.id), 0) as points,
    (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved') as weeks_approved,
    (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'pending') as pending_proofs,
    (select max(wp.updated_at) from weekly_progress wp
       where wp.user_id = pr.id and (wp.proof_url is not null or wp.proof_status <> 'none')) as last_proof_at,
    -- Today's habit ticks (distinct habit, out of 6).
    least(6, coalesce((select count(distinct hl.habit_id) from habit_logs hl
       where hl.user_id = pr.id and hl.log_date = current_date), 0))::int as habits_done_today,
    coalesce((select sum(fs.minutes) from focus_sessions fs
       where fs.user_id = pr.id and fs.created_at >= current_date), 0) as focus_minutes_today,
    (select count(*) from daily_actions da where da.user_id = pr.id and da.action_date = current_date and da.done) as actions_done,
    (select count(*) from daily_actions da where da.user_id = pr.id and da.action_date = current_date) as actions_total,
    coalesce((select least(100, round(dw.ml::numeric / nullif(dw.goal_ml, 0) * 100))::int
       from daily_water dw where dw.user_id = pr.id and dw.log_date = current_date), 0) as water_pct_today,
    (select count(*) from support_tickets st where st.user_id = pr.id and st.status in ('open', 'in_progress')) as open_tickets,
    exists(select 1 from habit_logs hl where hl.user_id = pr.id and hl.log_date >= (current_date - 3)) as habit_active_3d,
    -- Liveness: most recent signal across auth sign-in + any activity write.
    greatest(
      (select u.last_sign_in_at from auth.users u where u.id = pr.id),
      (select max(hl.created_at) from habit_logs hl where hl.user_id = pr.id),
      (select max(pl.awarded_at) from points_ledger pl where pl.user_id = pr.id),
      (select max(fs.created_at) from focus_sessions fs where fs.user_id = pr.id),
      (select max(wp.updated_at) from weekly_progress wp where wp.user_id = pr.id)
    ) as last_active_at,
    (greatest(
      (select u.last_sign_in_at from auth.users u where u.id = pr.id),
      (select max(hl.created_at) from habit_logs hl where hl.user_id = pr.id),
      (select max(pl.awarded_at) from points_ledger pl where pl.user_id = pr.id)
    ) >= now() - interval '15 minutes') as is_online_15m,
    -- At-risk: from week 3, three or more approved weeks behind (server formula).
    (
      pe.started_at is not null
      and least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) >= 3
      and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved')
          < least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) - 2
    ) as at_risk
  from parts
  join profiles pr on pr.id = parts.user_id
  left join batches b on b.id = parts.batch_id
  left join business_brains bb on bb.user_id = pr.id
  left join program_enrollments pe on pe.user_id = pr.id
  order by pr.full_name;
$$;
revoke all on function public.admin_live_participants(uuid) from anon, public;
grant execute on function public.admin_live_participants(uuid) to authenticated;
