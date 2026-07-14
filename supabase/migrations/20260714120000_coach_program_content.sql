-- Let COACHES manage program "Videos & Files" (upload-only), matching what
-- mentors/admins already do. Coaches never touch program STRUCTURE — that lives
-- in Program Builder / Manage Programs, gated to mentor+super_admin RPCs and not
-- in the coach nav. Here we only widen the per-week video + resource writes.
--
-- Already is_staff() (coach included) from earlier migrations:
--   • program_weeks class-video UPDATE  (20260623010000)
--   • class-videos storage bucket write (20260623010000)
-- Missing for coaches: the per-week downloads/resources table. Widen it to
-- is_staff() so the full "Videos & Files" page works for a coach.

drop policy if exists pwr_write on public.program_week_resources;
create policy pwr_write on public.program_week_resources
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
