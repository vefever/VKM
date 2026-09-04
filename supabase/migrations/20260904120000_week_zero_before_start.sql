-- Programme week must be 0 before the batch's start date, not 1.
--
-- Reporting RPCs computed the current week as:
--     greatest(1, floor((current_date - started_at::date) / 7) + 1)
--
-- Two problems for a batch that has not started yet. The greatest(1, …) floor
-- pins a future start to week 1; and because (current_date - date) is an integer,
-- `/ 7` is INTEGER division, which truncates toward zero — so a start three days
-- away gives 0, not -1, and even dropping the floor to greatest(0, …) would
-- still yield week 1. The date has to be compared explicitly.
--
-- Batch 17 (starting 2026-09-07) showed "WEEK 1" across the admin live tracker,
-- analytics and reports while the participant-side app correctly showed week 0.
--
-- Rather than restate a dozen large function bodies, this rewrites the
-- expression in place on whichever definition is currently live, so the fix
-- can't drift from the real definitions.
DO $$
DECLARE
  fn record;
  src text;
  fixed text;
  n int := 0;
BEGIN
  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND l.lanname IN ('sql', 'plpgsql')
      AND pg_get_functiondef(p.oid) ~ 'greatest\(\s*1\s*,\s*floor\(\(current_date'
  LOOP
    src := pg_get_functiondef(fn.oid);
    fixed := regexp_replace(
      src,
      'greatest\(\s*1\s*,\s*floor\(\(current_date - ([a-z_]*\.?started_at)::date\)\s*/\s*7\)\s*\+\s*1\)',
      '(case when \1::date > current_date then 0 else floor((current_date - \1::date) / 7) + 1 end)',
      'g'
    );
    IF fixed <> src THEN
      EXECUTE fixed;
      n := n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'week-zero fix applied to % function(s)', n;
END
$$;

-- Fail loudly if any live definition still carries the old expression.
DO $$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(p.proname, ', ')
  INTO leftover
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE ns.nspname = 'public'
    AND p.prokind = 'f'
    AND l.lanname IN ('sql', 'plpgsql')
    AND pg_get_functiondef(p.oid) ~ 'greatest\(\s*1\s*,\s*floor\(\(current_date';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'week-zero fix missed: %', leftover;
  END IF;
END
$$;
