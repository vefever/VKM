-- Mentorship is reflective: alongside the numbers, owners answer two short
-- coaching questions each month. These feed the coach review + AI Advisor.
ALTER TABLE public.business_snapshots
  ADD COLUMN IF NOT EXISTS reflection_win text,
  ADD COLUMN IF NOT EXISTS reflection_blocker text;
