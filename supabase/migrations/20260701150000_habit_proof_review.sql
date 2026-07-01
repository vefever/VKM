-- =========================================================
-- APPROVE / REJECT FOR DAILY HABIT PROOFS (2026-07-01)
--
-- Weekly proofs (weekly_progress) and business numbers (business_snapshots)
-- already have a coach review workflow. This adds the same to daily habit proofs
-- so staff can approve/reject the evidence participants attach when marking a
-- habit done. Points are unchanged — this is a verification flag, not a gate.
-- =========================================================

alter table public.habit_logs
  add column if not exists proof_status text not null default 'pending'
    check (proof_status in ('pending', 'approved', 'rejected')),
  add column if not exists coach_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists coach_id uuid references auth.users(id) on delete set null;

-- Staff review a habit proof. Habit proofs are already visible to all staff
-- (habit_logs SELECT policy), so review is gated the same way — is_staff() —
-- and only touches the review fields (no broad UPDATE policy is opened up).
create or replace function public.review_habit_proof(_log_id uuid, _status text, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_staff() then
    raise exception 'Forbidden: staff only';
  end if;
  if _status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid status';
  end if;

  select user_id into v_user from public.habit_logs where id = _log_id;
  if v_user is null then
    raise exception 'Habit proof not found';
  end if;

  update public.habit_logs
    set proof_status = _status,
        coach_note = nullif(btrim(coalesce(_note, '')), ''),
        reviewed_at = now(),
        coach_id = auth.uid()
    where id = _log_id;
end;
$$;
revoke execute on function public.review_habit_proof(uuid, text, text) from anon, public;
grant execute on function public.review_habit_proof(uuid, text, text) to authenticated;
