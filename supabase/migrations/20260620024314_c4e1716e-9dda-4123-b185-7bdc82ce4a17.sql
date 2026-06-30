-- =========================================================
-- VKM PROGRAM DOMAIN
-- =========================================================

-- 1. PROGRAM WEEKS (16-week curriculum)
CREATE TABLE public.program_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  week_no INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 52),
  phase TEXT NOT NULL,
  topic TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('Online','Offline')),
  why TEXT NOT NULL,
  task TEXT NOT NULL,
  proof TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_weeks TO authenticated;
GRANT ALL ON public.program_weeks TO service_role;
ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_weeks_read_all" ON public.program_weeks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_weeks_modify_staff" ON public.program_weeks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 2. MILESTONES
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unlock_week INTEGER NOT NULL,
  cost_inr INTEGER NOT NULL DEFAULT 0,
  reward_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  handover TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones_read_all" ON public.milestones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "milestones_modify_staff" ON public.milestones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 3. BUSINESS BRAIN
CREATE TABLE public.business_brains (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  industry TEXT,
  location TEXT,
  years_running INTEGER,
  current_mrr_inr BIGINT,
  target_mrr_inr BIGINT,
  team_size INTEGER,
  top_products TEXT,
  lead_sources TEXT,
  monthly_leads INTEGER,
  closing_rate_pct NUMERIC(5,2),
  avg_deal_inr BIGINT,
  top_challenges TEXT,
  success_definition TEXT,
  ai_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_brains TO authenticated;
GRANT ALL ON public.business_brains TO service_role;
ALTER TABLE public.business_brains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brains_own_or_staff_select" ON public.business_brains
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "brains_own_upsert" ON public.business_brains
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "brains_own_update" ON public.business_brains
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER business_brains_updated_at BEFORE UPDATE ON public.business_brains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. WEEKLY PROGRESS
CREATE TABLE public.weekly_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  week_no INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 52),
  attended BOOLEAN NOT NULL DEFAULT false,
  task_done BOOLEAN NOT NULL DEFAULT false,
  proof_url TEXT,
  proof_note TEXT,
  proof_status TEXT NOT NULL DEFAULT 'pending' CHECK (proof_status IN ('pending','approved','rejected')),
  coach_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_progress TO authenticated;
GRANT ALL ON public.weekly_progress TO service_role;
ALTER TABLE public.weekly_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_own_or_staff_select" ON public.weekly_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "wp_own_insert" ON public.weekly_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "wp_own_update" ON public.weekly_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (true);
CREATE TRIGGER weekly_progress_updated_at BEFORE UPDATE ON public.weekly_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. MONTHLY RESULTS
CREATE TABLE public.monthly_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  month_no INTEGER NOT NULL CHECK (month_no BETWEEN 1 AND 12),
  revenue_up BOOLEAN NOT NULL DEFAULT false,
  leads_up BOOLEAN NOT NULL DEFAULT false,
  closing_up BOOLEAN NOT NULL DEFAULT false,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_results TO authenticated;
GRANT ALL ON public.monthly_results TO service_role;
ALTER TABLE public.monthly_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mr_own_or_staff_select" ON public.monthly_results
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "mr_staff_write" ON public.monthly_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 6. POINTS LEDGER
CREATE TABLE public.points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('attend','task','revenue','leads','closing','bonus','manual')),
  reference TEXT,
  points INTEGER NOT NULL,
  awarded_by UUID REFERENCES auth.users(id),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_own_or_staff_select" ON public.points_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "pl_staff_write" ON public.points_ledger
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 7. MILESTONE AWARDS
CREATE TABLE public.milestone_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_code TEXT NOT NULL,
  awarded_by UUID REFERENCES auth.users(id),
  handover_mode TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestone_awards TO authenticated;
GRANT ALL ON public.milestone_awards TO service_role;
ALTER TABLE public.milestone_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma_own_or_staff_select" ON public.milestone_awards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ma_staff_write" ON public.milestone_awards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 8. ONBOARDING TASKS
CREATE TABLE public.onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL CHECK (step_no BETWEEN 1 AND 7),
  owner TEXT NOT NULL,
  description TEXT NOT NULL,
  due_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ob_own_or_staff_select" ON public.onboarding_tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(),'coach')
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ob_staff_write" ON public.onboarding_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 9. COACH VISITS (offline weeks)
CREATE TABLE public.coach_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_no INTEGER NOT NULL,
  visited_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_visits TO authenticated;
GRANT ALL ON public.coach_visits TO service_role;
ALTER TABLE public.coach_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cv_own_or_staff" ON public.coach_visits
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid()
    OR participant_id = auth.uid()
    OR public.has_role(auth.uid(),'mentor')
    OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "cv_staff_write" ON public.coach_visits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'mentor') OR public.has_role(auth.uid(),'super_admin'));

-- 10. AI ADVISOR THREADS
CREATE TABLE public.ai_advisor_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_advisor_threads TO authenticated;
GRANT ALL ON public.ai_advisor_threads TO service_role;
ALTER TABLE public.ai_advisor_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ait_own_select" ON public.ai_advisor_threads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ait_own_insert" ON public.ai_advisor_threads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =========================================================
-- HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.points_total(uid UUID)
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(points), 0)::int FROM public.points_ledger WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION public.current_stage(uid UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.points_total(uid) >= 1151 THEN 'Growth Champion'
    WHEN public.points_total(uid) >= 901  THEN 'Closer'
    WHEN public.points_total(uid) >= 601  THEN 'Operator'
    WHEN public.points_total(uid) >= 301  THEN 'Builder'
    ELSE 'Starter'
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.points_total(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_stage(UUID) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.points_total(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_stage(UUID) TO authenticated, service_role;

-- =========================================================
-- SEED: default VK Mentorship program + curriculum + milestones + Batch 16
-- =========================================================
DO $$
DECLARE
  prog UUID;
BEGIN
  INSERT INTO public.programs (title, description, duration_weeks, status)
  VALUES (
    'VK Mentorship — 16-Week Transformation',
    '4 Months · 16 weekly sessions (every Tuesday). Foundation → Systems → Sell → Review. Investment ₹8,00,000. VK takes the weekly group class; Growth Coaches drive individual implementation.',
    16,
    'active'
  )
  RETURNING id INTO prog;

  INSERT INTO public.program_weeks (program_id, week_no, phase, topic, mode, why, task, proof) VALUES
    (prog, 1, 'Foundation','Lifestyle Changes + OMM','Online','Discipline & rhythm drive growth','Install morning routine + start daily OMM','OMM running 5+ days; routine log'),
    (prog, 2, 'Foundation','Business Goals','Online','Setting the right number & breaking it down','Set annual + monthly goal, cascade to team','Written goal sheet'),
    (prog, 3, 'Foundation','Team Aspiration + Goal Reveal','Offline','Aligning the whole team to one target','Run team aspiration + goal reveal session','Team goal board photo'),
    (prog, 4, 'Foundation','Role Clarity','Offline','Who owns what — KRA & KPI','Define KRA/KPI for every role','Signed role clarity chart'),
    (prog, 5, 'Systems','Culture & Values','Online','A culture that runs without you','Define 3-5 values + expected behaviours','Values document'),
    (prog, 6, 'Systems','GAM + Review-to-Act','Online','The review rhythm that compounds','Start monthly GAM + weekly review','First GAM minutes'),
    (prog, 7, 'Systems','CRM Implementation','Offline','Never lose a lead again','Set up CRM, import leads, define stages','CRM live with real leads'),
    (prog, 8, 'Systems','CRM + Automation (Uniklife SAS)','Offline','Automate the repetitive work','Automate follow-ups & tasks','2+ automations live'),
    (prog, 9, 'Sell','Branding, USP & 4M Message','Online','Why customers should choose you','Finalise USP + 4M message','USP + message doc'),
    (prog,10, 'Sell','Content + Video Engine','Online','Show up consistently','Plan + publish content/videos','1 week of content live'),
    (prog,11, 'Sell','Lead Generation + Marketing Review','Online','Turn on daily leads','Launch 1 lead source + weekly review','Leads coming in daily'),
    (prog,12, 'Sell','Sales STEPS + SCRIPTS','Online','A repeatable sales process','Build the sales steps + scripts','Script in use'),
    (prog,13, 'Sell','Objection Handling + Closing','Online','Convert more, discount less','Train objections + closing','Closing rate tracked'),
    (prog,14, 'Sell','Follow-up + Sales Team Training','Offline','No lead left behind','Follow-up system + team role-plays','Sales team trained'),
    (prog,15, 'Review','Final Review','Offline','What''s working, what to fix','Full systems + numbers review','Completed review scorecard'),
    (prog,16, 'Review','Graduation & Certificate','Offline','Celebrate & commit to the next level','Before-after + goal reveal + certificate','Before-after results');

  INSERT INTO public.milestones (program_id, code, name, unlock_week, cost_inr, reward_items, handover) VALUES
    (prog,'goal_setter','Goal Setter',3,2000,
      '["Branded CEO journal + premium pen","Framed ''My Growth Goal'' print","Welcome shout-out on socials"]'::jsonb,
      'In person on Week 3 offline visit, in front of the team'),
    (prog,'system_builder','System Builder',6,3000,
      '["Engraved ''System Builder'' desk trophy","VK Mentorship polo T-shirt","15-min 1:1 call with VK","''Win of the Week'' feature"]'::jsonb,
      'Announced live in the Tuesday class'),
    (prog,'growth_champion','Growth Champion',14,5000,
      '["Engraved ''Growth Champion'' crystal trophy","Leather Closer''s Kit folder","Gift hamper","Signed book","Success-story feature + reel"]'::jsonb,
      'In person on Week 14 offline visit, in front of the team');

  INSERT INTO public.batches (program_id, name, start_date, capacity, status)
  VALUES (prog, 'Batch 16', CURRENT_DATE, 15, 'active');
END $$;
