-- =========================================================
-- SUPER ADMIN REPORTS (2026-07-03)
--
-- On-demand (not polled) reports scoped to a person / batch / coach / mentor
-- over an admin-chosen date range, with drilldown and Excel/PDF export on the
-- client. Five SECURITY DEFINER functions, all super_admin-gated, each a
-- single round trip that pre-aggregates in SQL (never dumps raw per-row data
-- to the client beyond capped, already-small history lists):
--   admin_people_search(_q, _limit)                  -> picker for "Individual"
--   admin_report_individual(_user_id, _from, _to)     -> one-on-one report
--   admin_report_batch(_batch_id, _from, _to)         -> batch-wise report
--   admin_report_coach(_coach_id, _from, _to)         -> coach -> participants
--   admin_report_mentor(_mentor_id, _from, _to)       -> mentor oversight
--
-- Supporting indexes added first so range-scoped aggregation (across ALL
-- users, not just one) stays index-backed as the platform grows past its
-- current small size.
-- =========================================================

create index if not exists habit_logs_log_date_idx on public.habit_logs (log_date);
create index if not exists points_ledger_awarded_at_idx on public.points_ledger (awarded_at);
create index if not exists points_ledger_user_awarded_idx on public.points_ledger (user_id, awarded_at);
create index if not exists weekly_progress_updated_idx on public.weekly_progress (updated_at);
create index if not exists batch_members_batch_role_idx on public.batch_members (batch_id, role);

-- ---------------------------------------------------------
-- 1. People picker (any role) for the "Individual" report tab.
-- ---------------------------------------------------------
create or replace function public.admin_people_search(_q text default '', _limit int default 20)
returns table (user_id uuid, full_name text, avatar_url text, roles text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url,
    (select coalesce(array_agg(ur.role::text order by ur.role::text), '{}') from user_roles ur where ur.user_id = p.id)
  from profiles p
  where _q = '' or p.full_name ilike '%' || _q || '%'
  order by p.full_name
  limit greatest(1, least(_limit, 50));
$$;
revoke all on function public.admin_people_search(text, int) from anon, public;
grant execute on function public.admin_people_search(text, int) to authenticated;

-- ---------------------------------------------------------
-- 2. Individual ("one on one") report — works for a participant, coach, or
--    mentor. Range-scoped trends + a capped proof/activity history.
-- ---------------------------------------------------------
create or replace function public.admin_report_individual(_user_id uuid, _from date, _to date)
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
    'profile', (
      select jsonb_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
        'phone', p.phone, 'is_alumni', p.is_alumni,
        'email', (select email from auth.users where id = p.id),
        'joined_at', (select created_at from auth.users where id = p.id),
        'last_active_at', (select last_sign_in_at from auth.users where id = p.id),
        'roles', (select coalesce(array_agg(ur.role::text order by ur.role::text), '{}') from user_roles ur where ur.user_id = p.id)
      )
      from profiles p where p.id = _user_id
    ),
    'enrollment', (
      select jsonb_build_object('started_at', pe.started_at, 'total_weeks', pe.total_weeks, 'status', pe.status)
      from program_enrollments pe where pe.user_id = _user_id
    ),
    'kpis', jsonb_build_object(
      'points_range', coalesce((select sum(points) from points_ledger where user_id = _user_id and awarded_at::date between _from and _to), 0),
      'weeks_approved', (select count(*) from weekly_progress where user_id = _user_id and proof_status = 'approved'),
      'weeks_pending', (select count(*) from weekly_progress where user_id = _user_id and proof_status = 'pending'),
      'habit_completion_avg_pct', (
        select coalesce(round(avg(least(done, 6)) / 6.0 * 100)::int, 0)
        from (
          select log_date, count(distinct habit_id) as done
          from habit_logs
          where user_id = _user_id and log_date between _from and _to
          group by log_date
        ) t
      ),
      'days_active_range', (select count(distinct log_date) from habit_logs where user_id = _user_id and log_date between _from and _to),
      'tickets_raised_range', (select count(*) from support_tickets where user_id = _user_id and created_at::date between _from and _to)
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'done', coalesce(h.done, 0), 'pct', coalesce(round(least(h.done, 6) / 6.0 * 100)::int, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select log_date, count(distinct habit_id) as done
        from habit_logs where user_id = _user_id and log_date between _from and _to
        group by log_date
      ) h on h.log_date = d::date
    ),
    'points_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'points', coalesce(pl.total, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select awarded_at::date as day, sum(points) as total
        from points_ledger where user_id = _user_id and awarded_at::date between _from and _to
        group by awarded_at::date
      ) pl on pl.day = d::date
    ),
    'proof_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_no', wp.week_no, 'proof_status', wp.proof_status, 'points', wp.points, 'updated_at', wp.updated_at
      ) order by wp.updated_at desc), '[]'::jsonb)
      from (
        select * from weekly_progress
        where user_id = _user_id and updated_at::date between _from and _to
        order by updated_at desc limit 200
      ) wp
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.ts desc), '[]'::jsonb)
      from (
        select kind, label, ts from (
          select 'points'::text as kind, ('+' || points || ' pts · ' || source) as label, awarded_at as ts
          from points_ledger where user_id = _user_id and awarded_at::date between _from and _to
          union all
          select 'proof', ('Week ' || week_no || ' proof ' || proof_status), updated_at
          from weekly_progress where user_id = _user_id and proof_status <> 'pending' and updated_at::date between _from and _to
        ) u
        order by ts desc limit 50
      ) a
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_individual(uuid, date, date) from anon, public;
grant execute on function public.admin_report_individual(uuid, date, date) to authenticated;

-- ---------------------------------------------------------
-- 3. Batch-wise report — KPIs, habit trend, and a per-participant roster
--    (batches are small, so an un-paginated roster is fine).
-- ---------------------------------------------------------
create or replace function public.admin_report_batch(_batch_id uuid, _from date, _to date)
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
    'batch', (select jsonb_build_object('batch_id', b.id, 'name', b.name, 'status', b.status, 'start_date', b.start_date) from batches b where b.id = _batch_id),
    'kpis', jsonb_build_object(
      'participant_count', (select count(*) from batch_members where batch_id = _batch_id and role = 'participant'),
      'avg_completion_pct', (
        select coalesce(round(avg(least(done, 6)) / 6.0 * 100)::int, 0)
        from (
          select hl.user_id, hl.log_date, count(distinct hl.habit_id) as done
          from habit_logs hl
          join batch_members bm on bm.user_id = hl.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
          where hl.log_date between _from and _to
          group by hl.user_id, hl.log_date
        ) t
      ),
      'points_range', coalesce((
        select sum(pl.points) from points_ledger pl
        join batch_members bm on bm.user_id = pl.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
        where pl.awarded_at::date between _from and _to
      ), 0)
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'avg_completion_pct', coalesce(h.pct, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select hl.log_date, round(avg(least(z.done, 6)) / 6.0 * 100)::int as pct
        from (
          select hl2.user_id, hl2.log_date, count(distinct hl2.habit_id) as done
          from habit_logs hl2
          join batch_members bm on bm.user_id = hl2.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
          where hl2.log_date between _from and _to
          group by hl2.user_id, hl2.log_date
        ) z
        join habit_logs hl on hl.log_date = z.log_date
        group by hl.log_date
      ) h on h.log_date = d::date
    ),
    'roster', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url,
        'current_week', least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)),
        'weeks_approved', (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved'),
        'points_range', coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to), 0),
        'completion_pct_range', coalesce((
          select round(avg(least(done, 6)) / 6.0 * 100)::int
          from (select log_date, count(distinct habit_id) as done from habit_logs where user_id = pr.id and log_date between _from and _to group by log_date) t
        ), 0),
        'at_risk', (
          least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved')
              < least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) - 2
        )
      ) order by pr.full_name), '[]'::jsonb)
      from batch_members bm
      join profiles pr on pr.id = bm.user_id
      left join program_enrollments pe on pe.user_id = pr.id
      where bm.batch_id = _batch_id and bm.role = 'participant'
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_batch(uuid, date, date) from anon, public;
grant execute on function public.admin_report_batch(uuid, date, date) to authenticated;

-- ---------------------------------------------------------
-- 4. Coach -> participants report — same roster shape as the batch report,
--    scoped by coach_assignments instead of batch_members.
-- ---------------------------------------------------------
create or replace function public.admin_report_coach(_coach_id uuid, _from date, _to date)
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
    'coach', (select jsonb_build_object('user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url) from profiles pr where pr.id = _coach_id),
    'kpis', jsonb_build_object(
      'participant_count', (select count(*) from coach_assignments where coach_id = _coach_id),
      'avg_completion_pct', (
        select coalesce(round(avg(least(done, 6)) / 6.0 * 100)::int, 0)
        from (
          select hl.user_id, hl.log_date, count(distinct hl.habit_id) as done
          from habit_logs hl
          join coach_assignments ca on ca.participant_id = hl.user_id and ca.coach_id = _coach_id
          where hl.log_date between _from and _to
          group by hl.user_id, hl.log_date
        ) t
      ),
      'points_awarded_range', coalesce((select sum(points) from points_ledger where awarded_by = _coach_id and awarded_at::date between _from and _to), 0)
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'avg_completion_pct', coalesce(h.pct, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select hl.log_date, round(avg(least(z.done, 6)) / 6.0 * 100)::int as pct
        from (
          select hl2.user_id, hl2.log_date, count(distinct hl2.habit_id) as done
          from habit_logs hl2
          join coach_assignments ca on ca.participant_id = hl2.user_id and ca.coach_id = _coach_id
          where hl2.log_date between _from and _to
          group by hl2.user_id, hl2.log_date
        ) z
        join habit_logs hl on hl.log_date = z.log_date
        group by hl.log_date
      ) h on h.log_date = d::date
    ),
    'roster', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url,
        'current_week', least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)),
        'weeks_approved', (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved'),
        'points_range', coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to), 0),
        'completion_pct_range', coalesce((
          select round(avg(least(done, 6)) / 6.0 * 100)::int
          from (select log_date, count(distinct habit_id) as done from habit_logs where user_id = pr.id and log_date between _from and _to group by log_date) t
        ), 0),
        'at_risk', (
          least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved')
              < least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) - 2
        )
      ) order by pr.full_name), '[]'::jsonb)
      from coach_assignments ca
      join profiles pr on pr.id = ca.participant_id
      left join program_enrollments pe on pe.user_id = pr.id
      where ca.coach_id = _coach_id
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_coach(uuid, date, date) from anon, public;
grant execute on function public.admin_report_coach(uuid, date, date) to authenticated;

-- ---------------------------------------------------------
-- 5. Mentor oversight report — review/ticket workload over the range.
-- ---------------------------------------------------------
create or replace function public.admin_report_mentor(_mentor_id uuid, _from date, _to date)
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
    'mentor', (select jsonb_build_object('user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url) from profiles pr where pr.id = _mentor_id),
    'kpis', jsonb_build_object(
      'proofs_reviewed_range', (
        (select count(*) from weekly_progress where coach_id = _mentor_id and reviewed_at::date between _from and _to)
        + (select count(*) from habit_logs where coach_id = _mentor_id and reviewed_at::date between _from and _to)
      ),
      'tickets_resolved_range', (
        select count(*) from support_tickets
        where assigned_to = _mentor_id and status in ('resolved', 'closed') and updated_at::date between _from and _to
      )
    ),
    'review_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'reviews', coalesce(r.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select day, count(*) as cnt from (
          select reviewed_at::date as day from weekly_progress where coach_id = _mentor_id and reviewed_at::date between _from and _to
          union all
          select reviewed_at::date as day from habit_logs where coach_id = _mentor_id and reviewed_at::date between _from and _to
        ) u
        group by day
      ) r on r.day = d::date
    ),
    'recent_reviews', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.ts desc), '[]'::jsonb)
      from (
        select kind, label, ts from (
          select 'weekly'::text as kind, ('Week ' || week_no || ' — ' || proof_status) as label, reviewed_at as ts
          from weekly_progress where coach_id = _mentor_id and reviewed_at::date between _from and _to
          union all
          select 'habit', ('Habit proof — ' || proof_status), reviewed_at
          from habit_logs where coach_id = _mentor_id and reviewed_at::date between _from and _to
        ) u
        order by ts desc limit 50
      ) a
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_mentor(uuid, date, date) from anon, public;
grant execute on function public.admin_report_mentor(uuid, date, date) to authenticated;
