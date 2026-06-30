-- =========================================================
-- SECURITY: coach horizontal isolation (2026-06-29)
--
-- Bug: ~20 participant-data tables granted ANY coach/mentor read access to
-- EVERY participant's rows via a bare `has_role(...,'coach')` / `is_staff()`
-- check with no cohort scope. A coach assigned to Batch 5 could read the
-- progress, habits, business data, vision, focus, chats and coaching notes of
-- participants in every other batch.
--
-- Fix: a SECURITY DEFINER helper `coaches_participant(uuid)` that is true only
-- when the caller (a coach or mentor) shares a batch with the given participant.
-- super_admin keeps org-wide read; participants keep their own-row access
-- (unchanged — those policies already key on user_id = auth.uid()).
--
-- This mirrors how `coach_cohort_overview()` already scopes coaches/mentors to
-- their own batches, so the dashboards and RLS now agree.
-- =========================================================

-- ---------------------------------------------------------
-- Helper: does the calling coach/mentor share a batch with _participant?
-- ---------------------------------------------------------
create or replace function public.coaches_participant(_participant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.batch_members me
    join public.batch_members them on them.batch_id = me.batch_id
    where me.user_id = auth.uid()
      and me.role in ('coach', 'mentor')
      and them.user_id = _participant
      and them.role = 'participant'
  );
$$;

revoke execute on function public.coaches_participant(uuid) from anon, public;
grant execute on function public.coaches_participant(uuid) to authenticated;

-- ---------------------------------------------------------
-- Tables keyed on user_id with a combined own-or-staff SELECT policy.
-- New rule: own row OR super_admin OR a coach/mentor in the same batch.
-- ---------------------------------------------------------

-- business_brains
drop policy if exists brains_own_or_staff_select on public.business_brains;
create policy brains_own_or_staff_select on public.business_brains
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- weekly_progress
drop policy if exists wp_own_or_staff_select on public.weekly_progress;
create policy wp_own_or_staff_select on public.weekly_progress
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- monthly_results
drop policy if exists mr_own_or_staff_select on public.monthly_results;
create policy mr_own_or_staff_select on public.monthly_results
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- points_ledger
drop policy if exists pl_own_or_staff_select on public.points_ledger;
create policy pl_own_or_staff_select on public.points_ledger
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- milestone_awards
drop policy if exists ma_own_or_staff_select on public.milestone_awards;
create policy ma_own_or_staff_select on public.milestone_awards
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- onboarding_tasks
drop policy if exists ob_own_or_staff_select on public.onboarding_tasks;
create policy ob_own_or_staff_select on public.onboarding_tasks
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- habit_logs
drop policy if exists habit_logs_select_own_or_staff on public.habit_logs;
create policy habit_logs_select_own_or_staff on public.habit_logs
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- daily_steps
drop policy if exists daily_steps_select_own_or_staff on public.daily_steps;
create policy daily_steps_select_own_or_staff on public.daily_steps
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- daily_water
drop policy if exists daily_water_select_own_or_staff on public.daily_water;
create policy daily_water_select_own_or_staff on public.daily_water
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- workout_logs
drop policy if exists workout_logs_select_own_or_staff on public.workout_logs;
create policy workout_logs_select_own_or_staff on public.workout_logs
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- water_events
drop policy if exists water_events_select_own_or_staff on public.water_events;
create policy water_events_select_own_or_staff on public.water_events
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- business_snapshots
drop policy if exists snap_select_own_or_staff on public.business_snapshots;
create policy snap_select_own_or_staff on public.business_snapshots
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- ---------------------------------------------------------
-- Staff-read-only tables (participant self-access lives in a separate
-- *_own / *_rw FOR ALL policy, so we only tighten the staff path here).
-- ---------------------------------------------------------

-- vision_statements
drop policy if exists vision_stmt_staff_read on public.vision_statements;
create policy vision_stmt_staff_read on public.vision_statements
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- vision_goals
drop policy if exists vision_goals_staff_read on public.vision_goals;
create policy vision_goals_staff_read on public.vision_goals
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- focus_sessions
drop policy if exists fs_staff_read on public.focus_sessions;
create policy fs_staff_read on public.focus_sessions
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- daily_actions
drop policy if exists da_staff_read on public.daily_actions;
create policy da_staff_read on public.daily_actions
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- coaching_notes (participant_id; the authoring coach also keeps access)
drop policy if exists cn_staff_read on public.coaching_notes;
create policy cn_staff_read on public.coaching_notes
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or coach_id = auth.uid()
    or public.coaches_participant(participant_id)
  );

-- ---------------------------------------------------------
-- Coaching chat: participant owns their thread; staff scoped to their batch.
-- ---------------------------------------------------------

-- conversations (participant_id)
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated using (
    participant_id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(participant_id)
  );

-- messages (scoped via the parent conversation's participant)
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (
    public.has_role(auth.uid(), 'super_admin')
    or conversation_id in (
      select id from public.conversations where participant_id = auth.uid()
    )
    or conversation_id in (
      select c.id from public.conversations c
      where public.coaches_participant(c.participant_id)
    )
  );

-- program_enrollments (user_id)
drop policy if exists pe_select on public.program_enrollments;
create policy pe_select on public.program_enrollments
  for select to authenticated using (
    auth.uid() = user_id
    or public.has_role(auth.uid(), 'super_admin')
    or public.coaches_participant(user_id)
  );

-- ---------------------------------------------------------
-- Broadcast scope: a coach broadcasting reached EVERY participant in every
-- batch. Keep mentor/super_admin org-wide, but limit a coach to the
-- participants who share one of their batches.
-- ---------------------------------------------------------
create or replace function public.notify_participants(
  _type text, _title text, _body text, _link text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  n integer;
  v_org_wide boolean;
BEGIN
  v_org_wide := public.has_role(auth.uid(), 'mentor')
             OR public.has_role(auth.uid(), 'super_admin');

  IF NOT (v_org_wide OR public.has_role(auth.uid(), 'coach')) THEN
    RAISE EXCEPTION 'Forbidden: only staff can broadcast';
  END IF;

  IF v_org_wide THEN
    -- Mentors / admins reach the whole cohort.
    INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
    SELECT ur.user_id, _type, _title, _body, _link, auth.uid()
    FROM public.user_roles ur
    WHERE ur.role = 'participant';
  ELSE
    -- A coach reaches only participants in batches they belong to.
    INSERT INTO public.notifications (user_id, type, title, body, link, actor_id)
    SELECT DISTINCT them.user_id, _type, _title, _body, _link, auth.uid()
    FROM public.batch_members me
    JOIN public.batch_members them ON them.batch_id = me.batch_id
    WHERE me.user_id = auth.uid()
      AND me.role IN ('coach', 'mentor')
      AND them.role = 'participant';
  END IF;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
revoke execute on function public.notify_participants(text, text, text, text) from anon, public;
grant execute on function public.notify_participants(text, text, text, text) to authenticated;
