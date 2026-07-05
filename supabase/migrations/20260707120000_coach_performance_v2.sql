-- =========================================================
-- COACH PERFORMANCE v2 — powerful, fair coach judgment (2026-07-07)
--
-- Goal: give mentors/admins everything they need to JUDGE coaches on real data:
--   • daily work rhythm (active days, reviews/day) + real login history
--   • responsiveness (turnaround, login recency)
--   • coverage (how much of the caseload they actually touch each week)
--   • OUTCOMES — how the coach's assigned participants actually do
--   • batch-wise performance + coach-vs-coach comparison
--
-- Adds:
--   1. coach_activity heartbeat table + coach_ping()  → real daily-login trend
--   2. coach_performance_report()  — rewritten with chat, recency, outcome,
--      coverage and login columns (keeps every existing column)
--   3. coach_daily_activity(coach, days)  — per-day series for a heatmap
--   4. coach_batch_breakdown()  — per coach×batch performance
--
-- All read RPCs keep the is_staff() guard (coach sees self via app scoping,
-- mentor/admin see everyone). coach_ping only writes for staff.
-- =========================================================

-- ── 1. Heartbeat: real daily-login / activity history ────────────────────────
create table if not exists public.coach_activity (
  coach_id      uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  last_seen_at  timestamptz not null default now(),
  hits          int  not null default 1,
  primary key (coach_id, activity_date)
);
alter table public.coach_activity enable row level security;
drop policy if exists coach_activity_select on public.coach_activity;
create policy coach_activity_select on public.coach_activity
  for select to authenticated
  using (coach_id = auth.uid() or public.is_staff());
grant select on public.coach_activity to authenticated;
grant all on public.coach_activity to service_role;

-- Called by the staff app on load; one row per coach per day, hits counts visits.
create or replace function public.coach_ping()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    return;  -- silently no-op for non-staff
  end if;
  insert into public.coach_activity (coach_id, activity_date, last_seen_at, hits)
  values (auth.uid(), current_date, now(), 1)
  on conflict (coach_id, activity_date)
  do update set last_seen_at = now(), hits = coach_activity.hits + 1;
end;
$$;
grant execute on function public.coach_ping() to authenticated;


-- ── 2. Coach performance report (rewritten, richer) ──────────────────────────
drop function if exists public.coach_performance_report();
create or replace function public.coach_performance_report()
returns table (
  coach_id             uuid,
  coach_name           text,
  coach_avatar         text,
  participant_count    bigint,
  reviews_total        bigint,
  reviews_approved     bigint,
  reviews_rejected     bigint,
  approval_rate        numeric,
  avg_turnaround_h     numeric,
  notes_count          bigint,
  meetings_count       bigint,
  notifs_sent          bigint,
  visits_count         bigint,
  chat_messages        bigint,
  reviews_7d           bigint,
  reviews_30d          bigint,
  active_days_30       bigint,
  login_days_30        bigint,
  at_risk_count        bigint,
  avg_progress_pct     numeric,
  caseload_active_3d_pct numeric,
  contacted_7d         bigint,
  last_review_at       timestamptz,
  last_note_at         timestamptz,
  last_message_at      timestamptz,
  last_login_at        timestamptz
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
      select ca.coach_id as c_id, count(distinct ca.participant_id) as participant_count
      from coach_assignments ca
      group by ca.coach_id
    ),
    rev as (
      select
        wp.coach_id                                                     as c_id,
        count(*)                                                        as reviews_total,
        count(*) filter (where wp.proof_status = 'approved')           as reviews_approved,
        count(*) filter (where wp.proof_status = 'rejected')           as reviews_rejected,
        case when count(*) > 0
          then round(count(*) filter (where wp.proof_status = 'approved')::numeric / count(*) * 100, 1)
          else 0 end                                                    as approval_rate,
        round(avg(
          case when wp.reviewed_at is not null and wp.created_at is not null and wp.reviewed_at > wp.created_at
            then extract(epoch from (wp.reviewed_at - wp.created_at)) / 3600.0 end
        )::numeric, 1)                                                  as avg_turnaround_h,
        count(*) filter (where wp.reviewed_at >= now() - interval '7 days')  as reviews_7d,
        count(*) filter (where wp.reviewed_at >= now() - interval '30 days') as reviews_30d,
        max(wp.reviewed_at)                                             as last_review_at
      from weekly_progress wp
      where wp.coach_id is not null and wp.reviewed_at is not null
      group by wp.coach_id
    ),
    notes as (
      select cn.coach_id as c_id, count(*) as notes_count, max(cn.occurred_at) as last_note_at
      from coaching_notes cn group by cn.coach_id
    ),
    mtgs as (
      select m.host_id as c_id, count(*) as meetings_count
      from meetings m where m.status <> 'cancelled' group by m.host_id
    ),
    nots as (
      select n.actor_id as c_id, count(*) as notifs_sent
      from notifications n where n.actor_id is not null group by n.actor_id
    ),
    vis as (
      select cv.coach_id as c_id, count(*) as visits_count
      from coach_visits cv group by cv.coach_id
    ),
    chat as (
      -- staff-authored chat messages (coach replying to a participant)
      select m.sender_id as c_id, count(*) as chat_messages, max(m.created_at) as last_message_at
      from messages m
      join coach_ids ci on ci.id = m.sender_id
      group by m.sender_id
    ),
    act as (
      -- distinct days with ANY coach action in the last 30 days (work rhythm)
      select c_id, count(distinct d) as active_days_30
      from (
        select wp.coach_id as c_id, wp.reviewed_at::date as d
          from weekly_progress wp where wp.coach_id is not null and wp.reviewed_at >= now() - interval '30 days'
        union
        select cn.coach_id, cn.occurred_at::date
          from coaching_notes cn where cn.occurred_at >= now() - interval '30 days'
        union
        select m.host_id, m.start_time::date
          from meetings m where m.status <> 'cancelled' and m.start_time >= now() - interval '30 days'
        union
        select ms.sender_id, ms.created_at::date
          from messages ms join coach_ids ci on ci.id = ms.sender_id where ms.created_at >= now() - interval '30 days'
      ) x
      group by c_id
    ),
    logins as (
      select ca2.coach_id as c_id,
             count(distinct ca2.activity_date) as login_days_30,
             max(ca2.last_seen_at)             as last_ping_at
      from coach_activity ca2
      where ca2.activity_date >= current_date - 30
      group by ca2.coach_id
    ),
    caseload as (
      -- one row per (coach, assigned participant) with that participant's outcome
      select
        ca.coach_id       as c_id,
        ca.participant_id as p_id,
        pe.started_at,
        coalesce(pe.total_weeks, 16) as total_weeks,
        (select count(*) from weekly_progress wp
           where wp.user_id = ca.participant_id and wp.proof_status = 'approved') as weeks_approved,
        exists(select 1 from habit_logs hl
           where hl.user_id = ca.participant_id and hl.log_date >= current_date - 3) as active_3d,
        greatest(
          (select max(wp.reviewed_at) from weekly_progress wp where wp.user_id = ca.participant_id and wp.coach_id = ca.coach_id),
          (select max(cn.occurred_at) from coaching_notes cn where cn.participant_id = ca.participant_id and cn.coach_id = ca.coach_id),
          (select max(mm.start_time)  from meetings mm     where mm.participant_id = ca.participant_id and mm.host_id = ca.coach_id and mm.status <> 'cancelled')
        ) as last_contact_at
      from coach_assignments ca
      left join program_enrollments pe on pe.user_id = ca.participant_id
    ),
    caseload_agg as (
      select
        c_id,
        count(*) filter (
          where started_at is not null
            and least(total_weeks, greatest(1, floor((current_date - started_at::date) / 7) + 1)) >= 3
            and weeks_approved < least(total_weeks, greatest(1, floor((current_date - started_at::date) / 7) + 1)) - 2
        )                                                                as at_risk_count,
        round(avg(case when total_weeks > 0
              then least(100, weeks_approved::numeric / total_weeks * 100) else 0 end), 0) as avg_progress_pct,
        round(100.0 * count(*) filter (where active_3d) / nullif(count(*), 0), 0)          as caseload_active_3d_pct,
        count(*) filter (where last_contact_at >= now() - interval '7 days')               as contacted_7d
      from caseload
      group by c_id
    )
    select
      c.id                                      as coach_id,
      coalesce(pr.full_name, 'Coach')           as coach_name,
      pr.avatar_url                             as coach_avatar,
      coalesce(cp.participant_count, 0)         as participant_count,
      coalesce(r.reviews_total,    0)           as reviews_total,
      coalesce(r.reviews_approved, 0)           as reviews_approved,
      coalesce(r.reviews_rejected, 0)           as reviews_rejected,
      coalesce(r.approval_rate,    0)           as approval_rate,
      r.avg_turnaround_h,
      coalesce(n.notes_count,      0)           as notes_count,
      coalesce(m.meetings_count,   0)           as meetings_count,
      coalesce(no.notifs_sent,     0)           as notifs_sent,
      coalesce(v.visits_count,     0)           as visits_count,
      coalesce(ch.chat_messages,   0)           as chat_messages,
      coalesce(r.reviews_7d,       0)           as reviews_7d,
      coalesce(r.reviews_30d,      0)           as reviews_30d,
      coalesce(a.active_days_30,   0)           as active_days_30,
      coalesce(lg.login_days_30,   0)           as login_days_30,
      coalesce(cag.at_risk_count,  0)           as at_risk_count,
      coalesce(cag.avg_progress_pct, 0)         as avg_progress_pct,
      coalesce(cag.caseload_active_3d_pct, 0)   as caseload_active_3d_pct,
      coalesce(cag.contacted_7d,   0)           as contacted_7d,
      r.last_review_at,
      n.last_note_at,
      ch.last_message_at,
      greatest((select u.last_sign_in_at from auth.users u where u.id = c.id), lg.last_ping_at) as last_login_at
    from coach_ids c
    join      profiles     pr  on pr.id  = c.id
    left join coach_parts  cp  on cp.c_id = c.id
    left join rev          r   on r.c_id  = c.id
    left join notes        n   on n.c_id  = c.id
    left join mtgs         m   on m.c_id  = c.id
    left join nots         no  on no.c_id = c.id
    left join vis          v   on v.c_id  = c.id
    left join chat         ch  on ch.c_id = c.id
    left join act          a   on a.c_id  = c.id
    left join logins       lg  on lg.c_id = c.id
    left join caseload_agg cag on cag.c_id = c.id
    order by reviews_total desc, coach_name;
end;
$$;
grant execute on function public.coach_performance_report() to authenticated;


-- ── 3. Per-day activity series (for a 30-day heatmap / sparkline) ─────────────
create or replace function public.coach_daily_activity(_coach_id uuid, _days int default 30)
returns table (
  day       date,
  reviews   bigint,
  notes     bigint,
  meetings  bigint,
  messages  bigint,
  logins    bigint
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
    with days as (
      select generate_series(current_date - (_days - 1), current_date, interval '1 day')::date as day
    )
    select
      d.day,
      (select count(*) from weekly_progress wp
         where wp.coach_id = _coach_id and wp.reviewed_at::date = d.day)                       as reviews,
      (select count(*) from coaching_notes cn
         where cn.coach_id = _coach_id and cn.occurred_at::date = d.day)                       as notes,
      (select count(*) from meetings mm
         where mm.host_id = _coach_id and mm.status <> 'cancelled' and mm.start_time::date = d.day) as meetings,
      (select count(*) from messages ms
         where ms.sender_id = _coach_id and ms.created_at::date = d.day)                       as messages,
      (select coalesce(sum(ca.hits), 0) from coach_activity ca
         where ca.coach_id = _coach_id and ca.activity_date = d.day)                           as logins
    from days d
    order by d.day;
end;
$$;
grant execute on function public.coach_daily_activity(uuid, int) to authenticated;


-- ── 4. Batch-wise performance (coach × batch matrix) ─────────────────────────
create or replace function public.coach_batch_breakdown()
returns table (
  coach_id         uuid,
  coach_name       text,
  batch_id         uuid,
  batch_name       text,
  participants     bigint,
  reviews_total    bigint,
  approval_rate    numeric,
  avg_progress_pct numeric,
  at_risk_count    bigint
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
    with cb as (
      -- each (coach, participant) tagged with that participant's (first) batch
      select
        ca.coach_id       as c_id,
        ca.participant_id as p_id,
        bsub.b_id,
        pe.started_at,
        coalesce(pe.total_weeks, 16) as total_weeks,
        (select count(*) from weekly_progress wp
           where wp.user_id = ca.participant_id and wp.proof_status = 'approved') as weeks_approved
      from coach_assignments ca
      left join lateral (
        select bm.batch_id as b_id
        from batch_members bm
        where bm.user_id = ca.participant_id and bm.role = 'participant'
        order by bm.batch_id
        limit 1
      ) bsub on true
      left join program_enrollments pe on pe.user_id = ca.participant_id
    ),
    rev as (
      -- reviews a coach did for participants in a given batch
      select wp.coach_id as c_id, wp.batch_id as b_id,
             count(*) as reviews_total,
             case when count(*) > 0
               then round(count(*) filter (where wp.proof_status = 'approved')::numeric / count(*) * 100, 1)
               else 0 end as approval_rate
      from weekly_progress wp
      where wp.coach_id is not null and wp.reviewed_at is not null
      group by wp.coach_id, wp.batch_id
    )
    select
      cb.c_id                                    as coach_id,
      coalesce(pc.full_name, 'Coach')            as coach_name,
      cb.b_id                                    as batch_id,
      coalesce(b.name, 'Unassigned')             as batch_name,
      count(*)                                   as participants,
      coalesce(max(r.reviews_total), 0)          as reviews_total,
      coalesce(max(r.approval_rate), 0)          as approval_rate,
      round(avg(case when cb.total_weeks > 0
            then least(100, cb.weeks_approved::numeric / cb.total_weeks * 100) else 0 end), 0) as avg_progress_pct,
      count(*) filter (
        where cb.started_at is not null
          and least(cb.total_weeks, greatest(1, floor((current_date - cb.started_at::date) / 7) + 1)) >= 3
          and cb.weeks_approved < least(cb.total_weeks, greatest(1, floor((current_date - cb.started_at::date) / 7) + 1)) - 2
      )                                          as at_risk_count
    from cb
    join      profiles pc on pc.id = cb.c_id
    left join batches  b  on b.id  = cb.b_id
    left join rev      r  on r.c_id = cb.c_id and r.b_id is not distinct from cb.b_id
    group by cb.c_id, pc.full_name, cb.b_id, b.name
    order by coach_name, batch_name;
end;
$$;
grant execute on function public.coach_batch_breakdown() to authenticated;
