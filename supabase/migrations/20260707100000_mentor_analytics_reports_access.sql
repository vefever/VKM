-- =========================================================
-- MENTOR access to analytics + reports (2026-07-05)
-- Mentors are senior staff overseeing the whole org, so they get the
-- same org-wide analytics + reports as super admins. Recreates each
-- admin_analytics_* / admin_report_* / admin_people_search function
-- verbatim, changing ONLY the guard from super_admin-only to
-- (mentor OR super_admin). Coaches/participants still get Forbidden.
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
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
