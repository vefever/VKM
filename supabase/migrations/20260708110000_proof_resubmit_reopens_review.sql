-- =========================================================
-- Proof resubmit re-opens review + points auto-removal (2026-07-08)
--
-- Two correctness fixes for the weekly-proof points flow:
--
-- 1) DUPLICATE POINTS — belt-and-suspenders: guarantee the ledger can never hold
--    two rows for the same award. The sync triggers already ON CONFLICT on this,
--    but re-assert the unique constraint so a duplicate is impossible even if a
--    future path inserts directly.
--
-- 2) REJECT / RESUBMIT AUTO-REMOVES POINTS — the participant guard previously
--    FROZE proof_status on any participant update, so a resubmitted proof kept
--    its old status: a rejected week never re-entered review, and an edited
--    approved week kept its 250 points. Now, when a participant changes their
--    proof, it goes back to 'pending' → the points sync trigger removes any
--    awarded points until a coach/mentor/admin approves it again. Staff updates
--    are untouched (their approve/reject already flows through the sync trigger,
--    which removes points on any non-approved status).
-- =========================================================

alter table public.points_ledger drop constraint if exists points_ledger_unique_ref;
alter table public.points_ledger add constraint points_ledger_unique_ref unique (user_id, source, reference);

create or replace function public.guard_weekly_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_staff boolean := public.has_role(auth.uid(), 'coach')
    or public.has_role(auth.uid(), 'mentor')
    or public.has_role(auth.uid(), 'super_admin');
begin
  -- Staff (coach / mentor / super admin) may set review columns directly; their
  -- approve/reject drives points via the sync trigger.
  if is_staff then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Participants create their own pending, unverified, unscored row.
    new.attended     := false;
    new.proof_status := 'pending';
    new.coach_id     := null;
    new.reviewed_at  := null;
  else
    -- Participants may edit proof content only; review columns stay staff-owned.
    new.attended := old.attended;
    new.coach_id := old.coach_id;
    if new.proof_url   is distinct from old.proof_url
       or new.proof_note  is distinct from old.proof_note
       or new.proof_files is distinct from old.proof_files then
      -- Proof changed → re-open for review. The points sync trigger then removes
      -- any awarded points for this week until it is approved again.
      new.proof_status := 'pending';
      new.reviewed_at  := null;
    else
      -- No proof change (e.g. an unrelated column write) — keep the review state.
      new.proof_status := old.proof_status;
      new.reviewed_at  := old.reviewed_at;
    end if;
  end if;

  return new;
end;
$$;
