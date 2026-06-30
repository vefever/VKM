-- =========================================================
-- Phase 4: close the review loop. Points are already auto-awarded on approval
-- (sync_weekly_points_ledger). This adds the missing NOTIFY step: whenever a
-- weekly proof is approved or rejected — from either the per-participant card or
-- the Proof Reviews page — the participant gets a notification with the coach's
-- note. Centralised at the DB so every review path notifies consistently.
-- =========================================================

create or replace function public.notify_proof_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points text := case when new.week_no between 1 and 14 then '250' else '0' end;
begin
  if new.proof_status is distinct from old.proof_status
     and new.proof_status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (
      new.user_id,
      case when new.proof_status = 'approved' then 'proof' else 'assignment' end,
      case when new.proof_status = 'approved'
           then 'Week ' || new.week_no || ' proof approved 🎉'
           else 'Week ' || new.week_no || ' proof needs changes' end,
      case when new.proof_status = 'approved'
           then 'Great work — you earned ' || v_points || ' points for Week ' || new.week_no || '.'
                || coalesce(' Coach note: ' || nullif(btrim(new.coach_note), ''), '')
           else 'Your coach asked for changes on Week ' || new.week_no || '.'
                || coalesce(' Note: ' || nullif(btrim(new.coach_note), ''), '') end,
      '/participant/progress',
      coalesce(new.coach_id, auth.uid())
    );
  end if;
  return null;
end;
$$;

drop trigger if exists weekly_progress_notify on public.weekly_progress;
create trigger weekly_progress_notify
  after update of proof_status on public.weekly_progress
  for each row execute function public.notify_proof_review();
