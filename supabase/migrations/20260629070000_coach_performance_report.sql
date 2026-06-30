-- ================================================================
-- Comprehensive coach performance report for mentor/admin oversight.
-- Two SECURITY DEFINER functions (staff-only gate):
--   1. coach_performance_report()     — one row per coach, all metrics
--   2. participant_coach_interactions() — one row per participant, showing
--      how much their coach has engaged with them
-- ================================================================

-- ── 1) Per-coach aggregate ──────────────────────────────────────
drop function if exists public.coach_performance_report();

create or replace function public.coach_performance_report()
returns table (
  coach_id          uuid,
  coach_name        text,
  coach_avatar      text,
  participant_count bigint,
  reviews_total     bigint,
  reviews_approved  bigint,
  reviews_rejected  bigint,
  approval_rate     numeric,
  avg_turnaround_h  numeric,
  notes_count       bigint,
  meetings_count    bigint,
  notifs_sent       bigint,
  visits_count      bigint,
  last_review_at    timestamptz,
  last_note_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Access denied: staff only';
  end if;

  return query
    with coach_ids as (
      select distinct user_id as id
      from user_roles
      where role in ('coach', 'mentor')
    ),
    coach_parts as (
      select
        bm_c.user_id as coach_id,
        count(distinct bm_p.user_id) as participant_count
      from batch_members bm_c
      join batch_members bm_p
        on bm_p.batch_id = bm_c.batch_id
        and bm_p.role = 'participant'
      where bm_c.role in ('coach', 'mentor')
      group by bm_c.user_id
    ),
    rev as (
      select
        coach_id,
        count(*)                                                  as reviews_total,
        count(*) filter (where proof_status = 'approved')        as reviews_approved,
        count(*) filter (where proof_status = 'rejected')        as reviews_rejected,
        case when count(*) > 0
          then round(
            count(*) filter (where proof_status = 'approved')::numeric
            / count(*) * 100, 1)
          else 0
        end as approval_rate,
        round(avg(
          case
            when reviewed_at is not null
             and created_at  is not null
             and reviewed_at > created_at
            then extract(epoch from (reviewed_at - created_at)) / 3600.0
          end
        )::numeric, 1) as avg_turnaround_h,
        max(reviewed_at) as last_review_at
      from weekly_progress
      where coach_id is not null and reviewed_at is not null
      group by coach_id
    ),
    notes as (
      select coach_id,
             count(*)        as notes_count,
             max(created_at) as last_note_at
      from coaching_notes
      group by coach_id
    ),
    mtgs as (
      select host_id as coach_id, count(*) as meetings_count
      from meetings
      where status <> 'cancelled'
      group by host_id
    ),
    nots as (
      select actor_id as coach_id, count(*) as notifs_sent
      from notifications
      where actor_id is not null
      group by actor_id
    ),
    vis as (
      select coach_id, count(*) as visits_count
      from coach_visits
      group by coach_id
    )
    select
      c.id                                      as coach_id,
      coalesce(pr.full_name, 'Coach')           as coach_name,
      pr.avatar_url                             as coach_avatar,
      coalesce(cp.participant_count, 0)         as participant_count,
      coalesce(r.reviews_total,   0)            as reviews_total,
      coalesce(r.reviews_approved, 0)           as reviews_approved,
      coalesce(r.reviews_rejected, 0)           as reviews_rejected,
      coalesce(r.approval_rate,   0)            as approval_rate,
      r.avg_turnaround_h,
      coalesce(n.notes_count,     0)            as notes_count,
      coalesce(m.meetings_count,  0)            as meetings_count,
      coalesce(no.notifs_sent,    0)            as notifs_sent,
      coalesce(v.visits_count,    0)            as visits_count,
      r.last_review_at,
      n.last_note_at
    from coach_ids c
    join    profiles    pr on pr.id    = c.id
    left join coach_parts cp on cp.coach_id = c.id
    left join rev         r  on r.coach_id  = c.id
    left join notes       n  on n.coach_id  = c.id
    left join mtgs        m  on m.coach_id  = c.id
    left join nots        no on no.coach_id = c.id
    left join vis         v  on v.coach_id  = c.id
    order by reviews_total desc, coach_name;
end;
$$;

grant execute on function public.coach_performance_report() to authenticated;


-- ── 2) Per-participant interaction map ─────────────────────────
drop function if exists public.participant_coach_interactions();

create or replace function public.participant_coach_interactions()
returns table (
  participant_id       uuid,
  participant_name     text,
  participant_avatar   text,
  batch_id             uuid,
  batch_name           text,
  primary_coach_id     uuid,
  primary_coach_name   text,
  weeks_approved       bigint,
  weeks_pending        bigint,
  total_points         bigint,
  reviews_received     bigint,
  coaching_notes       bigint,
  meetings_count       bigint,
  last_review_at       timestamptz,
  last_note_at         timestamptz,
  last_meeting_at      timestamptz,
  started_at           timestamptz,
  total_weeks          int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Access denied: staff only';
  end if;

  return query
    with parts as (
      -- One row per participant; first coach in their batch is "primary"
      select distinct on (bm_p.user_id)
        bm_p.user_id   as participant_id,
        bm_p.batch_id,
        b.name         as batch_name,
        bm_c.user_id   as coach_id,
        pc.full_name   as coach_name
      from batch_members bm_p
      join batches b on b.id = bm_p.batch_id
      left join batch_members bm_c
        on  bm_c.batch_id = bm_p.batch_id
        and bm_c.role in ('coach', 'mentor')
      left join profiles pc on pc.id = bm_c.user_id
      where bm_p.role = 'participant'
      order by bm_p.user_id, bm_p.batch_id
    ),
    proof_stats as (
      select
        user_id,
        count(*) filter (where proof_status = 'approved') as weeks_approved,
        count(*) filter (where proof_status = 'pending')  as weeks_pending,
        count(*) filter (where reviewed_at is not null)   as reviews_received,
        max(reviewed_at) as last_review_at
      from weekly_progress
      group by user_id
    ),
    pt_totals as (
      select user_id, sum(points) as total_points
      from points_ledger
      group by user_id
    ),
    cn_stats as (
      select participant_id,
             count(*)        as notes_count,
             max(created_at) as last_note_at
      from coaching_notes
      group by participant_id
    ),
    mtg_stats as (
      select participant_id,
             count(*)         as meetings_count,
             max(start_time)  as last_meeting_at
      from meetings
      where participant_id is not null and status <> 'cancelled'
      group by participant_id
    )
    select
      pa.participant_id,
      coalesce(pr.full_name, 'Participant')    as participant_name,
      pr.avatar_url                            as participant_avatar,
      pa.batch_id,
      pa.batch_name,
      pa.coach_id                              as primary_coach_id,
      coalesce(pa.coach_name, 'Unassigned')   as primary_coach_name,
      coalesce(ps.weeks_approved, 0)           as weeks_approved,
      coalesce(ps.weeks_pending,  0)           as weeks_pending,
      coalesce(pt.total_points,   0)           as total_points,
      coalesce(ps.reviews_received, 0)         as reviews_received,
      coalesce(cn.notes_count,    0)           as coaching_notes,
      coalesce(m.meetings_count,  0)           as meetings_count,
      ps.last_review_at,
      cn.last_note_at,
      m.last_meeting_at,
      pe.started_at,
      coalesce(pe.total_weeks, 16)             as total_weeks
    from parts pa
    join    profiles    pr on pr.id             = pa.participant_id
    left join proof_stats  ps on ps.user_id      = pa.participant_id
    left join pt_totals    pt on pt.user_id      = pa.participant_id
    left join cn_stats     cn on cn.participant_id = pa.participant_id
    left join mtg_stats    m  on m.participant_id  = pa.participant_id
    left join program_enrollments pe on pe.user_id = pa.participant_id
    order by participant_name;
end;
$$;

grant execute on function public.participant_coach_interactions() to authenticated;
