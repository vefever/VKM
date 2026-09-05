-- Realign day_no to each participant's batch start date.
--
-- WHAT WENT WRONG
-- A recent change made the app read the programme start from batches.start_date
-- rather than program_enrollments.started_at. For Batch 16 those disagreed:
-- enrollments said 2026-07-01 while the batch row still said 2026-06-20. Every
-- habit tick, water event and step count written in that window was therefore
-- stamped with a day_no eleven days too high (day 78 instead of day 67).
--
-- The tracker reads back by day_no, so those rows became invisible: participants
-- uploaded proofs and saw nothing appear. Batch 16 has since been corrected to
-- 2026-07-01, so new writes are right — but the rows written in between are not.
--
-- THE FIX
-- log_date is the calendar date the row was actually recorded on and was never
-- wrong, so day_no is recomputed from it rather than by shifting a fixed offset.
-- That repairs the mismatch whatever caused it, and is a no-op for rows that are
-- already correct.
--
-- Scoped to participants whose batch has a start_date. Rows that would land
-- before day 1 are left alone rather than clamped, so nothing is silently
-- rewritten into a day that did not exist.
-- DUPLICATES FIRST
-- habit_logs is unique on (user_id, habit_id, day_no). Where a participant
-- logged the same habit on the same calendar date under both the wrong and the
-- right day number, realigning would collide. Those stale rows are genuine
-- duplicates of a row that already sits on the correct day, so they are removed
-- — but ONLY when the surviving row carries at least as many proof files, so a
-- repair can never destroy the only copy of someone's proof.
WITH starts AS (
  SELECT bm.user_id, b.start_date
  FROM batch_members bm
  JOIN batches b ON b.id = bm.batch_id
  WHERE bm.role = 'participant' AND b.start_date IS NOT NULL
),
stale AS (
  SELECT h.id, h.user_id, h.habit_id, h.proof_files,
         (h.log_date - s.start_date) + 1 AS target_day
  FROM habit_logs h
  JOIN starts s ON s.user_id = h.user_id
  WHERE h.log_date IS NOT NULL
    AND (h.log_date - s.start_date) + 1 >= 1
    AND h.day_no IS DISTINCT FROM (h.log_date - s.start_date) + 1
)
DELETE FROM habit_logs d
USING stale, habit_logs keep
WHERE d.id = stale.id
  AND keep.user_id = stale.user_id
  AND keep.habit_id = stale.habit_id
  AND keep.day_no = stale.target_day
  AND keep.id <> d.id
  AND jsonb_array_length(coalesce(keep.proof_files, '[]'::jsonb))
      >= jsonb_array_length(coalesce(stale.proof_files, '[]'::jsonb));

DO $$
DECLARE
  t text;
  n int;
  total int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['habit_logs', 'daily_water', 'daily_steps', 'water_events', 'workout_logs']
  LOOP
    EXECUTE format($f$
      WITH starts AS (
        SELECT bm.user_id, b.start_date
        FROM batch_members bm
        JOIN batches b ON b.id = bm.batch_id
        WHERE bm.role = 'participant' AND b.start_date IS NOT NULL
      )
      UPDATE %I x
         SET day_no = (x.log_date - s.start_date) + 1
        FROM starts s
       WHERE x.user_id = s.user_id
         AND x.log_date IS NOT NULL
         AND (x.log_date - s.start_date) + 1 >= 1
         AND x.day_no IS DISTINCT FROM (x.log_date - s.start_date) + 1
    $f$, t);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    RAISE NOTICE '%: realigned % row(s)', t, n;
  END LOOP;
  RAISE NOTICE 'total realigned: %', total;
END
$$;
