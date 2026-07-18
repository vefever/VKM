-- =========================================================
-- BATCH-SCOPED ANALYTICS (2026-07-18)
--
-- The admin System Overview / Analytics pages previously dumped every
-- participant, coach, mentor and batch at once. This function scopes the whole
-- picture to ONE batch so those pages can drill down: batch → group
-- (participants / coaches / mentors) → an individual person.
--
-- Data model notes (verified against live data):
--   • batch_members holds ONLY participants (role = 'participant').
--   • Coaches are linked to participants through coach_assignments, and a
--     participant may have SEVERAL coaches — so a batch's coaches are derived
--     from its participants' assignments, with per-batch counts.
--   • Mentors have no batch link at all, so every mentor is listed but their
--     numbers are computed ONLY over this batch's participants.
--   • _batch_id = null returns participants who are in no batch, so admins can
--     still find them.
-- =========================================================

create or replace function public.admin_batch_analytics(_batch_id uuid default null)
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
    raise exception 'Forbidden: admin or mentor only';
  end if;

  with members as (
    select bm.user_id
    from batch_members bm
    where _batch_id is not null
      and bm.batch_id = _batch_id
      and bm.role = 'participant'
    union
    select ur.user_id
    from user_roles ur
    where _batch_id is null
      and ur.role = 'participant'
      and not exists (
        select 1 from batch_members b2
        where b2.user_id = ur.user_id and b2.role = 'participant'
      )
  ),
  base as (
    select
      m.user_id,
      pr.full_name,
      pr.avatar_url,
      coalesce(pe.total_weeks, 16) as total_weeks,
      pe.started_at,
      case
        when pe.started_at is null then 0
        else least(
          coalesce(pe.total_weeks, 16),
          greatest(1, floor((current_date - pe.started_at::date) / 7) + 1)
        )
      end as my_week,
      (select count(*) from weekly_progress wp
        where wp.user_id = m.user_id and wp.proof_status = 'approved') as weeks_done,
      (select count(*) from weekly_progress wp
        where wp.user_id = m.user_id and wp.proof_status = 'pending') as pending_proofs,
      (select coalesce(sum(pl.points), 0) from points_ledger pl
        where pl.user_id = m.user_id) as points,
      (select count(distinct hl.habit_id) from habit_logs hl
        where hl.user_id = m.user_id and hl.log_date = current_date) as habits_today,
      (select u.last_sign_in_at from auth.users u where u.id = m.user_id) as last_active_at
    from members m
    join profiles pr on pr.id = m.user_id
    left join program_enrollments pe on pe.user_id = m.user_id
  )
  select jsonb_build_object(
    'batch', (
      select to_jsonb(b) from (
        select id, name, status, start_date, program_id
        from batches where id = _batch_id
      ) b
    ),

    'summary', jsonb_build_object(
      'members',        (select count(*) from base),
      'active_7d',      (select count(*) from base where last_active_at >= now() - interval '7 days'),
      'avg_progress_pct', (
        select coalesce(round(avg(weeks_done::numeric / greatest(total_weeks, 1) * 100))::int, 0) from base
      ),
      'at_risk',        (select count(*) from base where my_week >= 3 and weeks_done < my_week - 2),
      'pending_proofs', (select coalesce(sum(pending_proofs), 0) from base),
      'total_points',   (select coalesce(sum(points), 0) from base)
    ),

    'participants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id',       b.user_id,
        'full_name',     b.full_name,
        'avatar_url',    b.avatar_url,
        'my_week',       b.my_week,
        'weeks_done',    b.weeks_done,
        'total_weeks',   b.total_weeks,
        'pending_proofs', b.pending_proofs,
        'points',        b.points,
        'habits_today',  b.habits_today,
        'at_risk',       (b.my_week >= 3 and b.weeks_done < b.my_week - 2),
        'last_active_at', b.last_active_at,
        'coaches', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'coach_id', c.id,
            'full_name', c.full_name,
            'reviews_30d', (
              select count(*) from weekly_progress wp
              where wp.coach_id = c.id and wp.user_id = b.user_id
                and wp.reviewed_at >= now() - interval '30 days'
            )
          ) order by c.full_name), '[]'::jsonb)
          from coach_assignments ca
          join profiles c on c.id = ca.coach_id
          where ca.participant_id = b.user_id
        )
      ) order by b.full_name), '[]'::jsonb)
      from base b
    ),

    -- Coaches of THIS batch: derived from its participants' assignments.
    'coaches', (
      select coalesce(jsonb_agg(t.x order by t.sort_name), '[]'::jsonb)
      from (
        select
          c.full_name as sort_name,
          jsonb_build_object(
            'coach_id',    c.id,
            'full_name',   c.full_name,
            'avatar_url',  c.avatar_url,
            'participants', count(distinct ca.participant_id),
            'at_risk',     count(distinct b2.user_id) filter (
                             where b2.my_week >= 3 and b2.weeks_done < b2.my_week - 2),
            'avg_habits_today', coalesce(round(avg(b2.habits_today), 1), 0),
            'reviews_30d', (
              select count(*) from weekly_progress wp
              where wp.coach_id = c.id
                and wp.reviewed_at >= now() - interval '30 days'
                and wp.user_id in (select user_id from base)
            ),
            'last_active_at', (select u.last_sign_in_at from auth.users u where u.id = c.id)
          ) as x
        from coach_assignments ca
        join base b2 on b2.user_id = ca.participant_id
        join profiles c on c.id = ca.coach_id
        group by c.id, c.full_name, c.avatar_url
      ) t
    ),

    -- Mentors are org-wide, but their numbers here cover ONLY this batch.
    'mentors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'mentor_id',  pr.id,
        'full_name',  pr.full_name,
        'avatar_url', pr.avatar_url,
        'reviews_30d', (
          select count(*) from weekly_progress wp
          where wp.coach_id = pr.id
            and wp.reviewed_at >= now() - interval '30 days'
            and wp.user_id in (select user_id from base)
        ),
        'habit_reviews_30d', (
          select count(*) from habit_logs hl
          where hl.coach_id = pr.id
            and hl.reviewed_at >= now() - interval '30 days'
            and hl.user_id in (select user_id from base)
        ),
        'last_active_at', (select u.last_sign_in_at from auth.users u where u.id = pr.id)
      ) order by pr.full_name), '[]'::jsonb)
      from user_roles ur
      join profiles pr on pr.id = ur.user_id
      where ur.role = 'mentor'
    ),

    -- Trends over THIS batch's participants only.
    'trends', jsonb_build_object(
      'habit_14d', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'pct', coalesce(h.pct, 0)) order by d), '[]'::jsonb)
        from generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') d
        left join (
          select z.log_date, round(avg(least(z.done, 6)) / 6.0 * 100)::int as pct
          from (
            select hl.log_date, hl.user_id, count(distinct hl.habit_id) as done
            from habit_logs hl
            where hl.user_id in (select user_id from base)
              and hl.log_date >= current_date - 13
            group by hl.log_date, hl.user_id
          ) z
          group by z.log_date
        ) h on h.log_date = d::date
      ),
      'points_30d', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'points', coalesce(p.total, 0)) order by d), '[]'::jsonb)
        from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') d
        left join (
          select pl.awarded_at::date as day, sum(pl.points) as total
          from points_ledger pl
          where pl.user_id in (select user_id from base)
            and pl.awarded_at >= current_date - 29
          group by pl.awarded_at::date
        ) p on p.day = d::date
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_batch_analytics(uuid) from anon, public;
grant execute on function public.admin_batch_analytics(uuid) to authenticated;
