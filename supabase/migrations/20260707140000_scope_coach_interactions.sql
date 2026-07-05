-- =========================================================
-- Fix: coach interaction stats were per-PARTICIPANT, not per-(coach, participant)
-- (2026-07-07)
--
-- participant_coach_interactions returns one row per (participant, assigned
-- coach), but reviews_received / coaching_notes / meetings / last_* were grouped
-- by participant alone. When a participant is assigned to several coaches (the
-- common case here), EVERY coach saw the same "last contacted / reviews / notes"
-- for that participant — so all coaches looked identical even though only one
-- actually did the work.
--
-- Rewrite so those interaction metrics are scoped to the SPECIFIC coach on the
-- row: "reviews I gave this participant", "notes I wrote", "meetings I hosted",
-- "the last time I contacted them". Participant-level facts (weeks approved,
-- points, progress) stay global — that's correctly the participant's own state.
--
-- Also surfaces each participant's DAILY-HABIT activity (habit_active_3d +
-- habits ticked today) so coaches can see habit engagement, not just proofs.
-- =========================================================

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
  total_weeks          int,
  habit_active_3d      boolean,
  habits_today         int
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
      -- one row per (participant, assigned coach); unassigned participants get a
      -- single row with a null coach so mentors/admins still see them.
      select
        ur.user_id     as p_id,
        bsub.b_id      as b_id,
        b.name         as b_name,
        ca.coach_id    as c_id,
        pc.full_name   as c_name
      from user_roles ur
      left join lateral (
        select bm.batch_id as b_id
        from batch_members bm
        where bm.user_id = ur.user_id and bm.role = 'participant'
        order by bm.batch_id
        limit 1
      ) bsub on true
      left join batches b on b.id = bsub.b_id
      left join coach_assignments ca on ca.participant_id = ur.user_id
      left join profiles pc on pc.id = ca.coach_id
      where ur.role = 'participant'
    )
    select
      pa.p_id                                    as participant_id,
      coalesce(pr.full_name, 'Participant')      as participant_name,
      pr.avatar_url                              as participant_avatar,
      pa.b_id                                    as batch_id,
      pa.b_name                                  as batch_name,
      pa.c_id                                    as primary_coach_id,
      coalesce(pa.c_name, 'Unassigned')         as primary_coach_name,
      -- Participant-level progress (global — this is the participant's own state)
      coalesce((select count(*) from weekly_progress wp
         where wp.user_id = pa.p_id and wp.proof_status = 'approved'), 0)      as weeks_approved,
      coalesce((select count(*) from weekly_progress wp
         where wp.user_id = pa.p_id and wp.proof_status = 'pending'), 0)       as weeks_pending,
      coalesce((select sum(pl.points) from points_ledger pl
         where pl.user_id = pa.p_id), 0)                                        as total_points,
      -- COACH-SCOPED interaction: this coach ↔ this participant only
      coalesce((select count(*) from weekly_progress wp
         where wp.user_id = pa.p_id and wp.coach_id = pa.c_id and wp.reviewed_at is not null), 0) as reviews_received,
      coalesce((select count(*) from coaching_notes cn
         where cn.participant_id = pa.p_id and cn.coach_id = pa.c_id), 0)      as coaching_notes,
      coalesce((select count(*) from meetings m
         where m.participant_id = pa.p_id and m.host_id = pa.c_id and m.status <> 'cancelled'), 0) as meetings_count,
      (select max(wp.reviewed_at) from weekly_progress wp
         where wp.user_id = pa.p_id and wp.coach_id = pa.c_id)                 as last_review_at,
      (select max(cn.occurred_at) from coaching_notes cn
         where cn.participant_id = pa.p_id and cn.coach_id = pa.c_id)          as last_note_at,
      (select max(m.start_time) from meetings m
         where m.participant_id = pa.p_id and m.host_id = pa.c_id and m.status <> 'cancelled') as last_meeting_at,
      pe.started_at,
      coalesce(pe.total_weeks, 16)               as total_weeks,
      -- Daily-habit engagement (participant-level)
      exists(select 1 from habit_logs hl
         where hl.user_id = pa.p_id and hl.log_date >= current_date - 3)       as habit_active_3d,
      least(6, coalesce((select count(distinct hl.habit_id) from habit_logs hl
         where hl.user_id = pa.p_id and hl.log_date = current_date), 0))::int  as habits_today
    from parts pa
    join    profiles    pr on pr.id              = pa.p_id
    left join program_enrollments pe on pe.user_id = pa.p_id
    order by participant_name;
end;
$$;
grant execute on function public.participant_coach_interactions() to authenticated;
