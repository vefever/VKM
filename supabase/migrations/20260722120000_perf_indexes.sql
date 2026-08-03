-- Performance: fill in the few missing indexes on hot, growing tables.
-- Most hot columns are already indexed; these cover query paths that currently
-- fall back to a scan and get slower as the cohort's data grows.

-- coach_assignments: only coach_id was indexed, but many reads (a participant's
-- coaches, the exemption/notify triggers) filter by participant_id.
create index if not exists coach_assignments_participant_idx
  on public.coach_assignments (participant_id);

-- water_events: existing index is (user_id, created_at); the day views filter by
-- (user_id, log_date). This table grows fastest (a row per glass).
create index if not exists water_events_user_date_idx
  on public.water_events (user_id, log_date);

-- weekly_progress: filtered by user_id on every participant profile / proof
-- submit, but only status/updated_at were indexed.
create index if not exists weekly_progress_user_idx
  on public.weekly_progress (user_id);

-- points_ledger: the ON CONFLICT target already provides a (user_id, source,
-- reference) unique index; nothing to add there.

analyze public.coach_assignments;
analyze public.water_events;
analyze public.weekly_progress;
