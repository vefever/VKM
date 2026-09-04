-- Performance + storage pass.
--
-- 1. RLS INITPLAN
-- user_roles holds 31 rows but had taken 18.4 MILLION sequential scans, and
-- coach_assignments 6.5 million. The index on user_roles(user_id, role) exists
-- and is used (2.1M index scans); the seq scans are Postgres correctly
-- preferring a single-page scan on a tiny table. The real cost is that
-- has_role() / coaches_participant() are CALLED once per candidate row, because
-- a bare function call in a policy is evaluated per row.
--
-- Wrapping the call in a scalar subquery lets the planner hoist it into an
-- InitPlan, evaluated ONCE per query. The expression is otherwise identical, so
-- this changes performance only — never who can see what.
--
-- 2. RETENTION
-- water_events holds one audited row per 250 ml tap (7,722 rows — the largest
-- row count in the database) purely as an audit trail; daily_water already
-- stores the running total the UI reads. It was the one high-volume table
-- missing from the existing weekly prune.

-- ---------------------------------------------------------------------------
-- 1. Hoist RLS helper calls into InitPlans
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
  nq text;
  nc text;
  changed int := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(has_role|coaches_participant)\('
  LOOP
    -- Skip anything already hoisted so a re-run cannot nest the subqueries.
    IF (coalesce(p.qual, '') || coalesce(p.with_check, '')) ~* 'select (has_role|coaches_participant)' THEN
      CONTINUE;
    END IF;

    -- Fixed-shape rewrites only; anything not matching these exact forms is
    -- left untouched rather than guessed at.
    nq := p.qual;
    nc := p.with_check;

    IF nq IS NOT NULL THEN
      nq := regexp_replace(nq, 'has_role\(auth\.uid\(\), ''([a-z_]+)''::app_role\)',
                               '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
      nq := regexp_replace(nq, 'coaches_participant\(([a-zA-Z_.]+)\)',
                               '(SELECT coaches_participant(\1))', 'g');
    END IF;
    IF nc IS NOT NULL THEN
      nc := regexp_replace(nc, 'has_role\(auth\.uid\(\), ''([a-z_]+)''::app_role\)',
                               '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
      nc := regexp_replace(nc, 'coaches_participant\(([a-zA-Z_.]+)\)',
                               '(SELECT coaches_participant(\1))', 'g');
    END IF;

    IF nq IS DISTINCT FROM p.qual OR nc IS DISTINCT FROM p.with_check THEN
      IF nq IS NOT NULL AND nc IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
          p.policyname, p.schemaname, p.tablename, nq, nc);
      ELSIF nq IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
          p.policyname, p.schemaname, p.tablename, nq);
      ELSE
        EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
          p.policyname, p.schemaname, p.tablename, nc);
      END IF;
      changed := changed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'RLS InitPlan applied to % policies', changed;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Add water_events to the existing weekly prune
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  delete from public.email_log            where created_at < now() - interval '30 days';
  delete from public.whatsapp_log         where created_at < now() - interval '30 days';
  delete from public.reminder_log         where created_at < now() - interval '30 days';
  delete from public.otp_requests         where created_at < now() - interval '1 day';
  delete from public.mfa_email_challenges where expires_at < now();
  delete from public.notifications        where created_at < now() - interval '30 days';
  -- One row per 250 ml tap, kept only as an audit trail: daily_water holds the
  -- running total the UI actually reads, so old events are safe to drop.
  delete from public.water_events         where created_at < now() - interval '30 days';
end;
$$;
REVOKE ALL ON FUNCTION public.prune_old_logs() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Drop a redundant index
-- batch_members(batch_id, role) has never been scanned and is a strict prefix
-- of batch_members(batch_id, user_id, role), which serves the same lookups.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.batch_members_batch_role_idx;

-- ---------------------------------------------------------------------------
-- 4. Reclaim what the prune frees and refresh planner statistics.
-- ---------------------------------------------------------------------------
SELECT public.prune_old_logs();
ANALYZE public.water_events;
ANALYZE public.notifications;
ANALYZE public.user_roles;
