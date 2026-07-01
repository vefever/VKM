-- =========================================================
-- NOTIFY ON HABIT PROOF REVIEW (2026-07-01)
--
-- Weekly proofs notify the participant on approve/reject via a trigger. Habit
-- proof review (review_habit_proof) didn't send anything — close that loop here.
-- Notifications are insert-only through SECURITY DEFINER functions, so we insert
-- directly inside this (already SECURITY DEFINER) function.
-- =========================================================

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
  v_note := nullif(btrim(coalesce(_note, '')), '');

  update public.habit_logs
    set proof_status = _status,
        coach_note = v_note,
        reviewed_at = now(),
        coach_id = auth.uid()
    where id = _log_id;

  -- Close the loop: tell the participant (skip on a plain 'pending' reset).
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
