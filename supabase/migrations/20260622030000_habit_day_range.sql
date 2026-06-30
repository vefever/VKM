-- The program grew from 90 days to 16 weeks (112 days) and is admin-configurable.
-- Relax the day_no bound so habit logging keeps working past day 90.
ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_day_no_check;
ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_day_no_check CHECK (day_no BETWEEN 1 AND 366);
