-- =========================================================
-- PROGRAM AUTOMATION — encode the VKM playbooks into the DB
-- Sources: Coach Playbook, Class Playbook, Onboarding Flow,
--          Gift Sourcing Guide, AI Advisor Setup.
-- =========================================================
-- Point values (Coach Playbook §6):
--   weekly:  +10 attend, +40 task & proof
--   monthly: +50 revenue up, +30 leads up, +30 closing up
-- Stages (already seeded): Starter / Builder / Operator / Closer / Growth Champion
-- =========================================================

-- ---------------------------------------------------------
-- 0. Idempotency: one ledger row per (user, source, reference).
--    Lets the sync triggers upsert/clean without double-counting.
--    Manual/bonus rows keep reference NULL → never collide.
-- ---------------------------------------------------------
ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_unique_ref UNIQUE (user_id, source, reference);

-- ---------------------------------------------------------
-- 1. Harden the weekly_progress guard:
--    attendance is coach-verified (Coach Playbook §3 "Review"),
--    so participants may not self-award it. proof_status / coach_id /
--    reviewed_at remain staff-only; points is fully derived (see #2).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_weekly_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff BOOLEAN := public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'mentor')
    OR public.has_role(auth.uid(), 'super_admin');
BEGIN
  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Participants create their own pending, unverified, unscored row.
    NEW.attended     := false;
    NEW.proof_status := 'pending';
    NEW.coach_id     := NULL;
    NEW.reviewed_at  := NULL;
  ELSE
    -- Participants may edit proof_url / proof_note / task_done only.
    NEW.attended     := OLD.attended;
    NEW.proof_status := OLD.proof_status;
    NEW.coach_id     := OLD.coach_id;
    NEW.reviewed_at  := OLD.reviewed_at;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 2. weekly_progress.points is a DERIVED cache: 10*attended + 40*approved.
--    Runs after the guard (alphabetical: _guard < _points_cache).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_points_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.points :=
    (CASE WHEN NEW.attended THEN 10 ELSE 0 END) +
    (CASE WHEN NEW.proof_status = 'approved' THEN 40 ELSE 0 END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_progress_points_cache ON public.weekly_progress;
CREATE TRIGGER weekly_progress_points_cache
  BEFORE INSERT OR UPDATE ON public.weekly_progress
  FOR EACH ROW EXECUTE FUNCTION public.weekly_points_cache();

-- ---------------------------------------------------------
-- 3. Sync weekly_progress -> points_ledger (the real source of truth
--    for points_total / current_stage). Attendance posts +10, an
--    approved proof posts +40; reversing the flag removes the row.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_weekly_points_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text := 'week:' || NEW.week_no;
  v_by  uuid := COALESCE(NEW.coach_id, auth.uid());
BEGIN
  -- Attendance (+10)
  IF NEW.attended THEN
    INSERT INTO public.points_ledger (user_id, source, reference, points, awarded_by)
    VALUES (NEW.user_id, 'attend', v_ref, 10, v_by)
    ON CONFLICT (user_id, source, reference)
      DO UPDATE SET points = 10, awarded_by = EXCLUDED.awarded_by, awarded_at = now();
  ELSE
    DELETE FROM public.points_ledger
    WHERE user_id = NEW.user_id AND source = 'attend' AND reference = v_ref;
  END IF;

  -- Task & proof (+40)
  IF NEW.proof_status = 'approved' THEN
    INSERT INTO public.points_ledger (user_id, source, reference, points, awarded_by)
    VALUES (NEW.user_id, 'task', v_ref, 40, v_by)
    ON CONFLICT (user_id, source, reference)
      DO UPDATE SET points = 40, awarded_by = EXCLUDED.awarded_by, awarded_at = now();
  ELSE
    DELETE FROM public.points_ledger
    WHERE user_id = NEW.user_id AND source = 'task' AND reference = v_ref;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS weekly_progress_ledger ON public.weekly_progress;
CREATE TRIGGER weekly_progress_ledger
  AFTER INSERT OR UPDATE OF attended, proof_status ON public.weekly_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_weekly_points_ledger();

-- ---------------------------------------------------------
-- 4. Monthly result bonuses (Coach Playbook §6):
--    +50 revenue up, +30 leads up, +30 closing up.
--    BEFORE: keep bonus_points in sync. AFTER: post to the ledger.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monthly_bonus_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.bonus_points :=
    (CASE WHEN NEW.revenue_up THEN 50 ELSE 0 END) +
    (CASE WHEN NEW.leads_up   THEN 30 ELSE 0 END) +
    (CASE WHEN NEW.closing_up THEN 30 ELSE 0 END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_results_bonus_cache ON public.monthly_results;
CREATE TRIGGER monthly_results_bonus_cache
  BEFORE INSERT OR UPDATE ON public.monthly_results
  FOR EACH ROW EXECUTE FUNCTION public.monthly_bonus_cache();

CREATE OR REPLACE FUNCTION public.sync_monthly_points_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text := 'month:' || NEW.month_no;
  v_by  uuid := auth.uid();
BEGIN
  PERFORM public._upsert_bonus(NEW.user_id, 'revenue', v_ref, NEW.revenue_up, 50, v_by);
  PERFORM public._upsert_bonus(NEW.user_id, 'leads',   v_ref, NEW.leads_up,   30, v_by);
  PERFORM public._upsert_bonus(NEW.user_id, 'closing', v_ref, NEW.closing_up, 30, v_by);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._upsert_bonus(
  _uid uuid, _source text, _ref text, _flag boolean, _pts int, _by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _flag THEN
    INSERT INTO public.points_ledger (user_id, source, reference, points, awarded_by)
    VALUES (_uid, _source, _ref, _pts, _by)
    ON CONFLICT (user_id, source, reference)
      DO UPDATE SET points = _pts, awarded_by = EXCLUDED.awarded_by, awarded_at = now();
  ELSE
    DELETE FROM public.points_ledger
    WHERE user_id = _uid AND source = _source AND reference = _ref;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._upsert_bonus(uuid, text, text, boolean, int, uuid) FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS monthly_results_ledger ON public.monthly_results;
CREATE TRIGGER monthly_results_ledger
  AFTER INSERT OR UPDATE OF revenue_up, leads_up, closing_up ON public.monthly_results
  FOR EACH ROW EXECUTE FUNCTION public.sync_monthly_points_ledger();

-- ---------------------------------------------------------
-- 5. Onboarding Flow: auto-seed the 7-step checklist for every
--    participant (owners + due-by straight from the PDF).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_participant_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'participant' THEN
    INSERT INTO public.onboarding_tasks (user_id, step_no, owner, description, due_by) VALUES
      (NEW.user_id, 1, 'Ops (Soumya)', 'Payment confirmed + welcome sent',            'Day 0'),
      (NEW.user_id, 2, 'Ops (Soumya)', 'Added to WhatsApp group + welcome kit',        'Day 1'),
      (NEW.user_id, 3, 'Ops (Soumya)', 'Growth Coach assigned & introduced',           'Day 2'),
      (NEW.user_id, 4, 'Coach',        'Kickoff 1:1 + baseline captured',              'Day 3-5'),
      (NEW.user_id, 5, 'Coach',        'AI Advisor + UNIKLIFE.AI + tracker set up',    'Day 5'),
      (NEW.user_id, 6, 'Participant',  'First Tuesday class attended',                 'Week 1'),
      (NEW.user_id, 7, 'Coach',        'Week 1 task (Lifestyle + OMM) started',        'Week 1')
    ON CONFLICT (user_id, step_no) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_seed_onboarding ON public.user_roles;
CREATE TRIGGER user_roles_seed_onboarding
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.seed_participant_onboarding();

-- ---------------------------------------------------------
-- 6. AI Advisor Setup: auto-generate the project-instructions prompt
--    from the Business Brain (only when not already customised).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gen_advisor_prompt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.ai_prompt IS NOT NULL AND length(trim(NEW.ai_prompt)) > 0 THEN
    RETURN NEW; -- keep coach/participant customisation
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;

  NEW.ai_prompt := format(
$brain$You are the personal business advisor for %s, owner of %s in %s. You follow Venu Kalyan's methodology: Implementation + Accountability + Systems = Growth. The owner is in the 4-month VK Mentorship (16 weeks: Foundation, Systems, Sell, Review). Use their Business Brain (below) as context. Give simple, practical, action-first advice in easy language - never heavy theory. Always tie advice to revenue, leads, closing, systems, or team. Ask 3-5 clarifying questions before giving any role-clarity, culture, GAM, marketing, or sales output - never generic content. Never invent numbers.

BUSINESS BRAIN
- Business: %s (%s), %s, %s years running
- Revenue: current Rs %s/mo -> target Rs %s/mo
- Team size: %s
- Top products/services: %s
- Lead sources: %s (~%s leads/mo)
- Closing rate: %s%% at avg deal Rs %s
- Biggest challenges: %s
- Success in 4 months: %s$brain$,
    COALESCE(v_name, 'the owner'),
    COALESCE(NEW.business_name, 'their business'),
    COALESCE(NEW.location, 'their city'),
    COALESCE(NEW.business_name, '-'),
    COALESCE(NEW.industry, '-'),
    COALESCE(NEW.location, '-'),
    COALESCE(NEW.years_running::text, '-'),
    COALESCE(NEW.current_mrr_inr::text, '-'),
    COALESCE(NEW.target_mrr_inr::text, '-'),
    COALESCE(NEW.team_size::text, '-'),
    COALESCE(NEW.top_products, '-'),
    COALESCE(NEW.lead_sources, '-'),
    COALESCE(NEW.monthly_leads::text, '-'),
    COALESCE(NEW.closing_rate_pct::text, '-'),
    COALESCE(NEW.avg_deal_inr::text, '-'),
    COALESCE(NEW.top_challenges, '-'),
    COALESCE(NEW.success_definition, '-')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_brains_gen_prompt ON public.business_brains;
CREATE TRIGGER business_brains_gen_prompt
  BEFORE INSERT OR UPDATE ON public.business_brains
  FOR EACH ROW EXECUTE FUNCTION public.gen_advisor_prompt();
