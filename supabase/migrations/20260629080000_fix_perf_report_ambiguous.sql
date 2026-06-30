-- Fix: qualify every bare column reference inside the RETURNS TABLE plpgsql
-- functions so PostgreSQL doesn't confuse them with the out-parameter names.

-- ── 1) coach_performance_report ────────────────────────────────
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
      select distinct ur.user_id as id
      from user_roles ur
      where ur.role in ('coach', 'mentor')
    ),
    coach_parts as (
      select
        bm_c.user_id                          as c_id,
        count(distinct bm_p.user_id)          as participant_count
      from batch_members bm_c
      join batch_members bm_p
        on  bm_p.batch_id = bm_c.batch_id
        and bm_p.role = 'participant'
      where bm_c.role in ('coach', 'mentor')
      group by bm_c.user_id
    ),
    rev as (
      select
        wp.coach_id                                                      as c_id,
        count(*)                                                         as reviews_total,
        count(*) filter (where wp.proof_status = 'approved')            as reviews_approved,
        count(*) filter (where wp.proof_status = 'rejected')            as reviews_rejected,
        case when count(*) > 0
          then round(
            count(*) filter (where wp.proof_status = 'approved')::numeric
            / count(*) * 100, 1)
          else 0
        end                                                              as approval_rate,
        round(avg(
          case
            when wp.reviewed_at is not null
             and wp.created_at  is not null
             and wp.reviewed_at > wp.created_at
            then extract(epoch from (wp.reviewed_at - wp.created_at)) / 3600.0
          end
        )::numeric, 1)                                                   as avg_turnaround_h,
        max(wp.reviewed_at)                                              as last_review_at
      from weekly_progress wp
      where wp.coach_id is not null and wp.reviewed_at is not null
      group by wp.coach_id
    ),
    notes as (
      select cn.coach_id  as c_id,
             count(*)     as notes_count,
             max(cn.created_at) as last_note_at
      from coaching_notes cn
      group by cn.coach_id
    ),
    mtgs as (
      select m.host_id    as c_id,
             count(*)     as meetings_count
      from meetings m
      where m.status <> 'cancelled'
      group by m.host_id
    ),
    nots as (
      select n.actor_id   as c_id,
             count(*)     as notifs_sent
      from notifications n
      where n.actor_id is not null
      group by n.actor_id
    ),
    vis as (
      select cv.coach_id  as c_id,
             count(*)     as visits_count
      from coach_visits cv
      group by cv.coach_id
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
    join    profiles    pr on pr.id   = c.id
    left join coach_parts cp on cp.c_id = c.id
    left join rev         r  on r.c_id  = c.id
    left join notes       n  on n.c_id  = c.id
    left join mtgs        m  on m.c_id  = c.id
    left join nots        no on no.c_id = c.id
    left join vis         v  on v.c_id  = c.id
    order by reviews_total desc, coach_name;
end;
$$;

grant execute on function public.coach_performance_report() to authenticated;


-- ── 2) participant_coach_interactions ──────────────────────────
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
      select distinct on (bm_p.user_id)
        bm_p.user_id   as p_id,
        bm_p.batch_id  as b_id,
        b.name         as b_name,
        bm_c.user_id   as c_id,
        pc.full_name   as c_name
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
        wp.user_id                                                       as p_id,
        count(*) filter (where wp.proof_status = 'approved')            as weeks_approved,
        count(*) filter (where wp.proof_status = 'pending')             as weeks_pending,
        count(*) filter (where wp.reviewed_at  is not null)             as reviews_received,
        max(wp.reviewed_at)                                              as last_review_at
      from weekly_progress wp
      group by wp.user_id
    ),
    pt_totals as (
      select pl.user_id as p_id, sum(pl.points) as total_points
      from points_ledger pl
      group by pl.user_id
    ),
    cn_stats as (
      select cn.participant_id as p_id,
             count(*)          as notes_count,
             max(cn.created_at) as last_note_at
      from coaching_notes cn
      group by cn.participant_id
    ),
    mtg_stats as (
      select m.participant_id  as p_id,
             count(*)          as meetings_count,
             max(m.start_time) as last_meeting_at
      from meetings m
      where m.participant_id is not null and m.status <> 'cancelled'
      group by m.participant_id
    )
    select
      pa.p_id                                    as participant_id,
      coalesce(pr.full_name, 'Participant')      as participant_name,
      pr.avatar_url                              as participant_avatar,
      pa.b_id                                    as batch_id,
      pa.b_name                                  as batch_name,
      pa.c_id                                    as primary_coach_id,
      coalesce(pa.c_name, 'Unassigned')         as primary_coach_name,
      coalesce(ps.weeks_approved,  0)            as weeks_approved,
      coalesce(ps.weeks_pending,   0)            as weeks_pending,
      coalesce(pt.total_points,    0)            as total_points,
      coalesce(ps.reviews_received, 0)           as reviews_received,
      coalesce(cn.notes_count,     0)            as coaching_notes,
      coalesce(m.meetings_count,   0)            as meetings_count,
      ps.last_review_at,
      cn.last_note_at,
      m.last_meeting_at,
      pe.started_at,
      coalesce(pe.total_weeks, 16)               as total_weeks
    from parts pa
    join    profiles    pr on pr.id              = pa.p_id
    left join proof_stats  ps on ps.p_id         = pa.p_id
    left join pt_totals    pt on pt.p_id         = pa.p_id
    left join cn_stats     cn on cn.p_id         = pa.p_id
    left join mtg_stats    m  on m.p_id          = pa.p_id
    left join program_enrollments pe on pe.user_id = pa.p_id
    order by participant_name;
end;
$$;

grant execute on function public.participant_coach_interactions() to authenticated;
