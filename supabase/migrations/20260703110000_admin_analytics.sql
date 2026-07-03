-- =========================================================
-- SUPER ADMIN ANALYTICS (2026-07-03)
--
-- Real platform analytics — participants, coaches, mentors, batches — computed
-- from our own tables (no external service). Four SECURITY DEFINER functions,
-- all super_admin-gated:
--   admin_analytics_overview()  -> KPIs + 30d signup / 14d habit / 30d points trends
--   admin_analytics_coaches()   -> per-coach caseload + performance
--   admin_analytics_batches()   -> per-batch health
--   admin_analytics_mentors()   -> per-mentor oversight activity
-- "Real-time" activity feed reuses the existing get_leaderboard_activity() RPC
-- (20260702030000) plus a live Supabase Realtime subscription on points_ledger
-- (added to the publication below) and the already-realtime habit_logs table.
-- The at-risk formula matches src/components/coach/coach-data.ts exactly:
-- week = min(total_weeks, max(1, floor(days_since_start/7)+1)); at risk when
-- week >= 3 and approved_weeks < week - 2.
-- =========================================================

create or replace function public.admin_analytics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_participants', (select count(*) from user_roles where role = 'participant'),
      'total_coaches', (select count(*) from user_roles where role = 'coach'),
      'total_mentors', (select count(*) from user_roles where role = 'mentor'),
      'total_admins', (select count(*) from user_roles where role = 'super_admin'),
      'active_batches', (select count(*) from batches where status = 'active'),
      'new_signups_7d', (select count(*) from profiles where created_at >= now() - interval '7 days'),
      'new_signups_30d', (select count(*) from profiles where created_at >= now() - interval '30 days'),
      'active_last_15m', (
        select count(distinct ur.user_id)
        from user_roles ur
        join auth.users u on u.id = ur.user_id
        where ur.role = 'participant'
          and (
            u.last_sign_in_at >= now() - interval '15 minutes'
            or exists (select 1 from habit_logs hl where hl.user_id = ur.user_id and hl.created_at >= now() - interval '15 minutes')
            or exists (select 1 from points_ledger pl where pl.user_id = ur.user_id and pl.awarded_at >= now() - interval '15 minutes')
          )
      ),
      'completion_today_pct', (
        select coalesce(round(avg(least(done, 6)) / 6.0 * 100)::int, 0)
        from (
          select hl.user_id, count(distinct hl.habit_id) as done
          from habit_logs hl
          join program_enrollments pe on pe.user_id = hl.user_id and pe.status = 'active'
          where hl.log_date = current_date
          group by hl.user_id
        ) t
      ),
      'at_risk_count', (
        select count(*)
        from (
          select
            pe.user_id,
            least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) as my_week,
            (select count(*) from weekly_progress wp where wp.user_id = pe.user_id and wp.proof_status = 'approved') as weeks_done
          from program_enrollments pe
          join user_roles ur on ur.user_id = pe.user_id and ur.role = 'participant'
          where pe.status = 'active' and pe.started_at is not null
        ) x
        where my_week >= 3 and weeks_done < my_week - 2
      ),
      'open_tickets', (select count(*) from support_tickets where status in ('open', 'in_progress'))
    ),
    'signup_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'count', coalesce(c.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') d
      left join (
        select created_at::date as day, count(*) as cnt
        from profiles
        where created_at >= current_date - 29
        group by created_at::date
      ) c on c.day = d::date
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d::date,
        'active_participants', coalesce(h.active_count, 0),
        'avg_completion_pct', coalesce(h.avg_pct, 0)
      ) order by d), '[]'::jsonb)
      from generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') d
      left join (
        select log_date,
          count(distinct user_id) as active_count,
          round(avg(least(done_ct, 6)) / 6.0 * 100)::int as avg_pct
        from (
          select log_date, user_id, count(distinct habit_id) as done_ct
          from habit_logs
          where log_date >= current_date - 13
          group by log_date, user_id
        ) z
        group by log_date
      ) h on h.log_date = d::date
    ),
    'points_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'points', coalesce(p.total, 0)) order by d), '[]'::jsonb)
      from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') d
      left join (
        select awarded_at::date as day, sum(points) as total
        from points_ledger
        where awarded_at >= current_date - 29
        group by awarded_at::date
      ) p on p.day = d::date
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_analytics_overview() from anon, public;
grant execute on function public.admin_analytics_overview() to authenticated;

-- ---------------------------------------------------------
-- Per-coach caseload + performance
-- ---------------------------------------------------------
create or replace function public.admin_analytics_coaches()
returns table (
  coach_id uuid,
  full_name text,
  avatar_url text,
  participant_count bigint,
  avg_completion_pct int,
  at_risk_count bigint,
  points_awarded_30d bigint,
  last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  return query
  with mine as (
    select ur.user_id as coach_id
    from user_roles ur
    where ur.role = 'coach'
  ),
  parts as (
    select ca.coach_id, ca.participant_id
    from coach_assignments ca
    join mine m on m.coach_id = ca.coach_id
  ),
  today_done as (
    select hl.user_id, count(distinct hl.habit_id) as done
    from habit_logs hl
    where hl.log_date = current_date
    group by hl.user_id
  ),
  risk as (
    select
      pe.user_id,
      least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) as my_week,
      (select count(*) from weekly_progress wp where wp.user_id = pe.user_id and wp.proof_status = 'approved') as weeks_done
    from program_enrollments pe
    where pe.status = 'active' and pe.started_at is not null
  )
  select
    m.coach_id,
    pr.full_name,
    pr.avatar_url,
    count(distinct p.participant_id) as participant_count,
    coalesce(round(avg(least(coalesce(td.done, 0), 6)) / 6.0 * 100)::int, 0) as avg_completion_pct,
    count(distinct r.user_id) filter (where r.my_week >= 3 and r.weeks_done < r.my_week - 2) as at_risk_count,
    coalesce((
      select sum(pl.points) from points_ledger pl
      where pl.awarded_by = m.coach_id and pl.awarded_at >= now() - interval '30 days'
    ), 0) as points_awarded_30d,
    (select u.last_sign_in_at from auth.users u where u.id = m.coach_id) as last_active_at
  from mine m
  join profiles pr on pr.id = m.coach_id
  left join parts p on p.coach_id = m.coach_id
  left join today_done td on td.user_id = p.participant_id
  left join risk r on r.user_id = p.participant_id
  group by m.coach_id, pr.full_name, pr.avatar_url
  order by participant_count desc, pr.full_name;
end;
$$;

revoke all on function public.admin_analytics_coaches() from anon, public;
grant execute on function public.admin_analytics_coaches() to authenticated;

-- ---------------------------------------------------------
-- Per-batch health
-- ---------------------------------------------------------
create or replace function public.admin_analytics_batches()
returns table (
  batch_id uuid,
  name text,
  status text,
  participant_count bigint,
  avg_week numeric,
  avg_completion_pct int,
  at_risk_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  return query
  with members as (
    select bm.batch_id, bm.user_id
    from batch_members bm
    where bm.role = 'participant'
  ),
  today_done as (
    select hl.user_id, count(distinct hl.habit_id) as done
    from habit_logs hl
    where hl.log_date = current_date
    group by hl.user_id
  ),
  risk as (
    select
      pe.user_id,
      least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) as my_week,
      (select count(*) from weekly_progress wp where wp.user_id = pe.user_id and wp.proof_status = 'approved') as weeks_done
    from program_enrollments pe
    where pe.status = 'active' and pe.started_at is not null
  )
  select
    b.id as batch_id,
    b.name,
    b.status,
    count(distinct me.user_id) as participant_count,
    round(avg(r.my_week)::numeric, 1) as avg_week,
    coalesce(round(avg(least(coalesce(td.done, 0), 6)) / 6.0 * 100)::int, 0) as avg_completion_pct,
    count(distinct r.user_id) filter (where r.my_week >= 3 and r.weeks_done < r.my_week - 2) as at_risk_count
  from batches b
  left join members me on me.batch_id = b.id
  left join today_done td on td.user_id = me.user_id
  left join risk r on r.user_id = me.user_id
  group by b.id, b.name, b.status
  order by (b.status = 'active') desc, participant_count desc, b.name;
end;
$$;

revoke all on function public.admin_analytics_batches() from anon, public;
grant execute on function public.admin_analytics_batches() to authenticated;

-- ---------------------------------------------------------
-- Per-mentor oversight activity (mentors see org-wide, so differentiate by
-- their own review/support workload rather than a caseload count)
-- ---------------------------------------------------------
create or replace function public.admin_analytics_mentors()
returns table (
  mentor_id uuid,
  full_name text,
  avatar_url text,
  proofs_reviewed_30d bigint,
  tickets_handled_30d bigint,
  last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  return query
  select
    ur.user_id as mentor_id,
    pr.full_name,
    pr.avatar_url,
    (
      (select count(*) from weekly_progress wp where wp.coach_id = ur.user_id and wp.reviewed_at >= now() - interval '30 days')
      + (select count(*) from habit_logs hl where hl.coach_id = ur.user_id and hl.reviewed_at >= now() - interval '30 days')
    ) as proofs_reviewed_30d,
    (
      select count(*) from support_tickets st
      where st.assigned_to = ur.user_id
        and st.status in ('resolved', 'closed')
        and st.updated_at >= now() - interval '30 days'
    ) as tickets_handled_30d,
    (select u.last_sign_in_at from auth.users u where u.id = ur.user_id) as last_active_at
  from user_roles ur
  join profiles pr on pr.id = ur.user_id
  where ur.role = 'mentor'
  order by pr.full_name;
end;
$$;

revoke all on function public.admin_analytics_mentors() from anon, public;
grant execute on function public.admin_analytics_mentors() to authenticated;

-- ---------------------------------------------------------
-- Live activity: add points_ledger to the realtime publication so the admin
-- dashboard's activity feed can push-update instantly (habit_logs is already
-- realtime-enabled since 20260621010000).
-- ---------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.points_ledger;
exception when duplicate_object then null;
end $$;
