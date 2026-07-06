-- =========================================================
-- Reports v2 — ultra-detailed report cards (2026-07-08)
--
-- Recreates the four report RPCs with far more depth, keeping every existing
-- key (so the UI never breaks) and ADDING rich new sections:
--   • individual: batch + coaches, all-time points, business snapshot, wellness
--     (focus/water/steps), habit streak, milestones, meetings, approval rate
--   • batch: at-risk / alumni / active counts, coach coverage, top performers,
--     who-needs-attention
--   • coach: reviews + approvals + turnaround + notes + meetings + at-risk in range
--   • mentor: proofs approved/rejected, meetings hosted, batches & coaches overseen
--
-- Guard unchanged (mentor OR super_admin). All SECURITY DEFINER.
-- =========================================================

-- ── Individual ───────────────────────────────────────────────────────────────
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
    'batch_name', (
      select b.name from batch_members bm join batches b on b.id = bm.batch_id
      where bm.user_id = _user_id and bm.role = 'participant' order by b.name limit 1
    ),
    'coaches', (
      select coalesce(jsonb_agg(cp.full_name order by cp.full_name), '[]'::jsonb)
      from coach_assignments ca join profiles cp on cp.id = ca.coach_id where ca.participant_id = _user_id
    ),
    'total_points', coalesce((select sum(points) from points_ledger where user_id = _user_id), 0),
    'business', (
      select jsonb_build_object(
        'business_name', bb.business_name, 'industry', bb.industry, 'location', bb.location,
        'current_mrr_inr', bb.current_mrr_inr, 'target_mrr_inr', bb.target_mrr_inr,
        'monthly_leads', bb.monthly_leads, 'closing_rate_pct', bb.closing_rate_pct, 'team_size', bb.team_size
      )
      from business_brains bb where bb.user_id = _user_id
    ),
    'milestones_count', (select count(*) from milestone_awards where user_id = _user_id),
    'milestones', (
      select coalesce(jsonb_agg(jsonb_build_object('code', milestone_code, 'awarded_at', awarded_at) order by awarded_at desc), '[]'::jsonb)
      from milestone_awards where user_id = _user_id
    ),
    'kpis', jsonb_build_object(
      'points_range', coalesce((select sum(points) from points_ledger where user_id = _user_id and awarded_at::date between _from and _to), 0),
      'weeks_approved', (select count(*) from weekly_progress where user_id = _user_id and proof_status = 'approved'),
      'weeks_pending', (select count(*) from weekly_progress where user_id = _user_id and proof_status = 'pending'),
      'weeks_rejected', (select count(*) from weekly_progress where user_id = _user_id and proof_status = 'rejected'),
      'proof_approval_rate', (
        select case when count(*) filter (where reviewed_at is not null) > 0
          then round(count(*) filter (where proof_status = 'approved')::numeric / count(*) filter (where reviewed_at is not null) * 100)::int
          else 0 end
        from weekly_progress where user_id = _user_id
      ),
      'habit_completion_avg_pct', (
        select coalesce(round(avg(least(done, 6)) / 6.0 * 100)::int, 0)
        from (select log_date, count(distinct habit_id) as done from habit_logs where user_id = _user_id and log_date between _from and _to group by log_date) t
      ),
      'days_active_range', (select count(distinct log_date) from habit_logs where user_id = _user_id and log_date between _from and _to),
      'streak_current', (
        with d as (select distinct log_date from habit_logs where user_id = _user_id and log_date <= _to),
        grp as (select log_date, (log_date - (row_number() over (order by log_date))::int) as g from d)
        select coalesce((select count(*) from grp where g = (select g from grp order by log_date desc limit 1)), 0)
      ),
      'focus_minutes_range', coalesce((select sum(minutes) from focus_sessions where user_id = _user_id and created_at::date between _from and _to), 0),
      'focus_sessions_range', (select count(*) from focus_sessions where user_id = _user_id and created_at::date between _from and _to),
      'water_adherence_pct', coalesce((select round(avg(least(100, ml::numeric / nullif(goal_ml, 0) * 100)))::int from daily_water where user_id = _user_id and log_date between _from and _to), 0),
      'steps_avg', coalesce((select round(avg(steps))::int from daily_steps where user_id = _user_id and log_date between _from and _to), 0),
      'meetings_attended_range', (select count(*) from meetings where participant_id = _user_id and status <> 'cancelled' and start_time::date between _from and _to),
      'tickets_raised_range', (select count(*) from support_tickets where user_id = _user_id and created_at::date between _from and _to)
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'done', coalesce(h.done, 0), 'pct', coalesce(round(least(h.done, 6) / 6.0 * 100)::int, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (select log_date, count(distinct habit_id) as done from habit_logs where user_id = _user_id and log_date between _from and _to group by log_date) h on h.log_date = d::date
    ),
    'points_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'points', coalesce(pl.total, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (select awarded_at::date as day, sum(points) as total from points_ledger where user_id = _user_id and awarded_at::date between _from and _to group by awarded_at::date) pl on pl.day = d::date
    ),
    'proof_history', (
      select coalesce(jsonb_agg(jsonb_build_object('week_no', wp.week_no, 'proof_status', wp.proof_status, 'points', wp.points, 'updated_at', wp.updated_at) order by wp.updated_at desc), '[]'::jsonb)
      from (select * from weekly_progress where user_id = _user_id and updated_at::date between _from and _to order by updated_at desc limit 200) wp
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


-- ── Batch ────────────────────────────────────────────────────────────────────
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
          from habit_logs hl join batch_members bm on bm.user_id = hl.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
          where hl.log_date between _from and _to group by hl.user_id, hl.log_date
        ) t
      ),
      'points_range', coalesce((
        select sum(pl.points) from points_ledger pl
        join batch_members bm on bm.user_id = pl.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
        where pl.awarded_at::date between _from and _to
      ), 0),
      'at_risk_count', (
        select count(*) from batch_members bm
        join profiles pr on pr.id = bm.user_id
        left join program_enrollments pe on pe.user_id = pr.id
        where bm.batch_id = _batch_id and bm.role = 'participant'
          and pe.started_at is not null
          and least(coalesce(pe.total_weeks,16), greatest(1, floor((current_date - pe.started_at::date)/7)+1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status='approved')
              < least(coalesce(pe.total_weeks,16), greatest(1, floor((current_date - pe.started_at::date)/7)+1)) - 2
      ),
      'alumni_count', (select count(*) from batch_members bm join profiles pr on pr.id = bm.user_id where bm.batch_id = _batch_id and bm.role='participant' and pr.is_alumni),
      'active_3d_pct', (
        select case when count(*) > 0 then round(100.0 * count(*) filter (where exists (select 1 from habit_logs hl where hl.user_id = bm.user_id and hl.log_date >= current_date - 3)) / count(*))::int else 0 end
        from batch_members bm where bm.batch_id = _batch_id and bm.role = 'participant'
      ),
      'coach_count', (
        select count(distinct ca.coach_id) from coach_assignments ca
        join batch_members bm on bm.user_id = ca.participant_id and bm.batch_id = _batch_id and bm.role = 'participant'
      ),
      'unassigned_count', (
        select count(*) from batch_members bm
        where bm.batch_id = _batch_id and bm.role = 'participant'
          and not exists (select 1 from coach_assignments ca where ca.participant_id = bm.user_id)
      )
    ),
    'top_performers', (
      select coalesce(jsonb_agg(x order by (x->>'points_range')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('full_name', pr.full_name, 'points_range', coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to),0)) as x
        from batch_members bm join profiles pr on pr.id = bm.user_id
        where bm.batch_id = _batch_id and bm.role = 'participant'
        order by coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to),0) desc limit 5
      ) s
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'avg_completion_pct', coalesce(h.pct, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select hl.log_date, round(avg(least(z.done, 6)) / 6.0 * 100)::int as pct
        from (
          select hl2.user_id, hl2.log_date, count(distinct hl2.habit_id) as done
          from habit_logs hl2 join batch_members bm on bm.user_id = hl2.user_id and bm.batch_id = _batch_id and bm.role = 'participant'
          where hl2.log_date between _from and _to group by hl2.user_id, hl2.log_date
        ) z join habit_logs hl on hl.log_date = z.log_date group by hl.log_date
      ) h on h.log_date = d::date
    ),
    'roster', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url,
        'current_week', least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)),
        'weeks_approved', (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved'),
        'points_range', coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to), 0),
        'completion_pct_range', coalesce((select round(avg(least(done, 6)) / 6.0 * 100)::int from (select log_date, count(distinct habit_id) as done from habit_logs where user_id = pr.id and log_date between _from and _to group by log_date) t), 0),
        'at_risk', (
          least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved')
              < least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) - 2
        )
      ) order by pr.full_name), '[]'::jsonb)
      from batch_members bm join profiles pr on pr.id = bm.user_id
      left join program_enrollments pe on pe.user_id = pr.id
      where bm.batch_id = _batch_id and bm.role = 'participant'
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_batch(uuid, date, date) from anon, public;
grant execute on function public.admin_report_batch(uuid, date, date) to authenticated;


-- ── Coach ────────────────────────────────────────────────────────────────────
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
          from habit_logs hl join coach_assignments ca on ca.participant_id = hl.user_id and ca.coach_id = _coach_id
          where hl.log_date between _from and _to group by hl.user_id, hl.log_date
        ) t
      ),
      'points_awarded_range', coalesce((select sum(points) from points_ledger where awarded_by = _coach_id and awarded_at::date between _from and _to), 0),
      'reviews_range', (select count(*) from weekly_progress where coach_id = _coach_id and reviewed_at::date between _from and _to),
      'approvals_range', (select count(*) from weekly_progress where coach_id = _coach_id and proof_status = 'approved' and reviewed_at::date between _from and _to),
      'approval_rate', (
        select case when count(*) > 0 then round(count(*) filter (where proof_status='approved')::numeric / count(*) * 100)::int else 0 end
        from weekly_progress where coach_id = _coach_id and reviewed_at::date between _from and _to
      ),
      'avg_turnaround_h', (
        select coalesce(round(avg(extract(epoch from (reviewed_at - created_at))/3600.0)::numeric, 1), 0)
        from weekly_progress where coach_id = _coach_id and reviewed_at is not null and reviewed_at > created_at and reviewed_at::date between _from and _to
      ),
      'notes_range', (select count(*) from coaching_notes where coach_id = _coach_id and occurred_at::date between _from and _to),
      'meetings_range', (select count(*) from meetings where host_id = _coach_id and status <> 'cancelled' and start_time::date between _from and _to),
      'at_risk_count', (
        select count(*) from coach_assignments ca
        join profiles pr on pr.id = ca.participant_id
        left join program_enrollments pe on pe.user_id = pr.id
        where ca.coach_id = _coach_id
          and pe.started_at is not null
          and least(coalesce(pe.total_weeks,16), greatest(1, floor((current_date - pe.started_at::date)/7)+1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status='approved')
              < least(coalesce(pe.total_weeks,16), greatest(1, floor((current_date - pe.started_at::date)/7)+1)) - 2
      ),
      'active_3d_pct', (
        select case when count(*) > 0 then round(100.0 * count(*) filter (where exists (select 1 from habit_logs hl where hl.user_id = ca.participant_id and hl.log_date >= current_date - 3)) / count(*))::int else 0 end
        from coach_assignments ca where ca.coach_id = _coach_id
      )
    ),
    'habit_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'avg_completion_pct', coalesce(h.pct, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select hl.log_date, round(avg(least(z.done, 6)) / 6.0 * 100)::int as pct
        from (
          select hl2.user_id, hl2.log_date, count(distinct hl2.habit_id) as done
          from habit_logs hl2 join coach_assignments ca on ca.participant_id = hl2.user_id and ca.coach_id = _coach_id
          where hl2.log_date between _from and _to group by hl2.user_id, hl2.log_date
        ) z join habit_logs hl on hl.log_date = z.log_date group by hl.log_date
      ) h on h.log_date = d::date
    ),
    'roster', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url,
        'current_week', least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)),
        'weeks_approved', (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved'),
        'points_range', coalesce((select sum(points) from points_ledger where user_id = pr.id and awarded_at::date between _from and _to), 0),
        'completion_pct_range', coalesce((select round(avg(least(done, 6)) / 6.0 * 100)::int from (select log_date, count(distinct habit_id) as done from habit_logs where user_id = pr.id and log_date between _from and _to group by log_date) t), 0),
        'at_risk', (
          least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) >= 3
          and (select count(*) from weekly_progress wp where wp.user_id = pr.id and wp.proof_status = 'approved')
              < least(coalesce(pe.total_weeks, 16), greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)) - 2
        )
      ) order by pr.full_name), '[]'::jsonb)
      from coach_assignments ca join profiles pr on pr.id = ca.participant_id
      left join program_enrollments pe on pe.user_id = pr.id
      where ca.coach_id = _coach_id
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_coach(uuid, date, date) from anon, public;
grant execute on function public.admin_report_coach(uuid, date, date) to authenticated;


-- ── Mentor ───────────────────────────────────────────────────────────────────
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
    raise exception 'Forbidden: super admin only';
  end if;

  select jsonb_build_object(
    'mentor', (select jsonb_build_object('user_id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url) from profiles pr where pr.id = _mentor_id),
    'kpis', jsonb_build_object(
      'proofs_reviewed_range', (
        (select count(*) from weekly_progress where coach_id = _mentor_id and reviewed_at::date between _from and _to)
        + (select count(*) from habit_logs where coach_id = _mentor_id and reviewed_at::date between _from and _to)
      ),
      'proofs_approved_range', (select count(*) from weekly_progress where coach_id = _mentor_id and proof_status = 'approved' and reviewed_at::date between _from and _to),
      'proofs_rejected_range', (select count(*) from weekly_progress where coach_id = _mentor_id and proof_status = 'rejected' and reviewed_at::date between _from and _to),
      'meetings_hosted_range', (select count(*) from meetings where host_id = _mentor_id and status <> 'cancelled' and start_time::date between _from and _to),
      'tickets_resolved_range', (
        select count(*) from support_tickets
        where assigned_to = _mentor_id and status in ('resolved', 'closed') and updated_at::date between _from and _to
      ),
      'batches_overseen', (select count(*) from batches where status = 'active'),
      'coaches_total', (select count(distinct user_id) from user_roles where role = 'coach')
    ),
    'review_trend', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'reviews', coalesce(r.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(_from::timestamp, _to::timestamp, interval '1 day') d
      left join (
        select day, count(*) as cnt from (
          select reviewed_at::date as day from weekly_progress where coach_id = _mentor_id and reviewed_at::date between _from and _to
          union all
          select reviewed_at::date as day from habit_logs where coach_id = _mentor_id and reviewed_at::date between _from and _to
        ) u group by day
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
        ) u order by ts desc limit 50
      ) a
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_report_mentor(uuid, date, date) from anon, public;
grant execute on function public.admin_report_mentor(uuid, date, date) to authenticated;
