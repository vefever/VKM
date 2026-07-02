-- =========================================================
-- SECURITY HARDENING — WRITE-SIDE COHORT ISOLATION (2026-07-02)
--
-- Follow-up to 20260629110000 (which scoped SELECT to coaches_participant) and
-- 20260629130000 / 20260701140000 (which made coaches_participant() assignment-
-- based: true for a coach's ASSIGNED participants, and for any mentor/super_admin).
--
-- Those migrations fixed cross-cohort READS but left the WRITE policies on the
-- same tables using a bare has_role('coach'), so any coach could approve proofs
-- / award points / grant milestones to ANY participant platform-wide. This
-- migration re-scopes the write side to coaches_participant() so writes match
-- reads. It also:
--   • tightens profiles SELECT (was leaking every user's phone to every coach),
--   • adds a guard trigger so a participant can't self-approve a habit proof,
--   • scopes review_habit_proof() to the reviewer's own participants.
-- Participants keep their own-row access throughout (user_id = auth.uid()).
-- =========================================================

-- ---------------------------------------------------------
-- 1. weekly_progress — INSERT + UPDATE (proof approval / point trigger)
-- ---------------------------------------------------------
drop policy if exists "wp_own_insert" on public.weekly_progress;
create policy "wp_own_insert" on public.weekly_progress
  for insert to authenticated
  with check (user_id = auth.uid() or public.coaches_participant(user_id));

drop policy if exists "wp_own_update" on public.weekly_progress;
create policy "wp_own_update" on public.weekly_progress
  for update to authenticated
  using (user_id = auth.uid() or public.coaches_participant(user_id))
  with check (user_id = auth.uid() or public.coaches_participant(user_id));

-- ---------------------------------------------------------
-- 2. points_ledger — staff INSERT (award points)
-- ---------------------------------------------------------
drop policy if exists "pl_staff_write" on public.points_ledger;
create policy "pl_staff_write" on public.points_ledger
  for insert to authenticated
  with check (public.coaches_participant(user_id));

-- ---------------------------------------------------------
-- 3. monthly_results — staff FOR ALL (write path only; SELECT already scoped)
-- ---------------------------------------------------------
drop policy if exists "mr_staff_write" on public.monthly_results;
create policy "mr_staff_write" on public.monthly_results
  for all to authenticated
  using (public.coaches_participant(user_id))
  with check (public.coaches_participant(user_id));

-- ---------------------------------------------------------
-- 4. milestone_awards — staff FOR ALL (grant milestones)
-- ---------------------------------------------------------
drop policy if exists "ma_staff_write" on public.milestone_awards;
create policy "ma_staff_write" on public.milestone_awards
  for all to authenticated
  using (public.coaches_participant(user_id))
  with check (public.coaches_participant(user_id));

-- ---------------------------------------------------------
-- 5. profiles SELECT — stop leaking phone (PII) of every user to every coach.
--    Self + mentor/super_admin (org-wide) + a coach's OWN participants only.
--    Name/avatar of non-assigned peers still resolves via get_profiles_display().
-- ---------------------------------------------------------
drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'mentor')
    or public.coaches_participant(id)
  );

-- ---------------------------------------------------------
-- 6. habit_logs — prevent a participant from self-approving their own proof.
--    (There is no UPDATE policy, but INSERT let a user set proof_status /
--    coach_id / reviewed_at directly.) Force those to server-controlled values
--    for non-staff; staff writes (via review_habit_proof) are unaffected.
-- ---------------------------------------------------------
create or replace function public.guard_habit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    new.proof_status := 'pending';
    new.coach_id := null;
    new.reviewed_at := null;
    new.coach_note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_habit_log_ins on public.habit_logs;
create trigger guard_habit_log_ins
  before insert on public.habit_logs
  for each row execute function public.guard_habit_log();

-- ---------------------------------------------------------
-- 7. review_habit_proof — a coach may only review their OWN participants'
--    proofs (mentor/super_admin keep org-wide via coaches_participant()).
-- ---------------------------------------------------------
create or replace function public.review_habit_proof(_log_id uuid, _status text, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_day int;
  v_note text;
begin
  if not public.is_staff() then
    raise exception 'Forbidden: staff only';
  end if;
  if _status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid status';
  end if;

  select user_id, day_no into v_user, v_day from public.habit_logs where id = _log_id;
  if v_user is null then
    raise exception 'Habit proof not found';
  end if;

  -- Cohort isolation: coaches can only review participants assigned to them.
  if not public.coaches_participant(v_user) then
    raise exception 'Forbidden: not your participant';
  end if;

  v_note := nullif(btrim(coalesce(_note, '')), '');

  update public.habit_logs
    set proof_status = _status,
        coach_note = v_note,
        reviewed_at = now(),
        coach_id = auth.uid()
    where id = _log_id;

  if _status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (
      v_user,
      case when _status = 'approved' then 'proof' else 'assignment' end,
      case when _status = 'approved'
           then 'Habit proof approved ✅'
           else 'Habit proof needs changes' end,
      case when _status = 'approved'
           then 'Your coach approved your Day ' || v_day || ' habit proof.'
                || coalesce(' Note: ' || v_note, '')
           else 'Your coach asked for changes on your Day ' || v_day || ' habit proof.'
                || coalesce(' Note: ' || v_note, '') end,
      '/participant/habits',
      auth.uid()
    );
  end if;
end;
$$;

revoke execute on function public.review_habit_proof(uuid, text, text) from anon, public;
grant execute on function public.review_habit_proof(uuid, text, text) to authenticated;

-- ---------------------------------------------------------
-- 8. OTP rate-limit ledger — the pre-auth request_otp endpoint had no throttle
--    (email-bombing / provider-quota abuse). The `messaging` edge function
--    records each attempt here (via the service role) and refuses to send when
--    a per-email / per-IP window is exceeded. Locked to service_role only.
-- ---------------------------------------------------------
create table if not exists public.otp_requests (
  id bigint generated always as identity primary key,
  bucket text not null,          -- 'email:<addr>' or 'ip:<addr>'
  created_at timestamptz not null default now()
);
create index if not exists otp_requests_bucket_time on public.otp_requests (bucket, created_at desc);

alter table public.otp_requests enable row level security;
revoke all on public.otp_requests from anon, authenticated;
grant all on public.otp_requests to service_role;
-- No policies for anon/authenticated → the table is invisible to clients; only
-- the service role (edge function) can read/write it.
