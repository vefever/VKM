-- =========================================================
-- POINTS MODEL v2
--   Weekly task + proof:  +250 / week for Weeks 1–14  (= 3500 total)
--                          0 for Weeks 15–16
--   Daily habit:           +10 per task ticked
--   Attendance:            folded into the weekly 250 (no separate award)
-- =========================================================

-- 0. Allow a 'habit' source in the ledger.
alter table public.points_ledger drop constraint if exists points_ledger_source_check;
alter table public.points_ledger
  add constraint points_ledger_source_check
  check (source in ('attend', 'task', 'habit', 'revenue', 'leads', 'closing', 'bonus', 'manual'));

-- 1. weekly_progress.points cache: 250 when approved in Weeks 1–14, else 0.
create or replace function public.weekly_points_cache()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.points := case
    when new.proof_status = 'approved' and new.week_no between 1 and 14 then 250
    else 0
  end;
  return new;
end;
$$;

-- 2. Sync weekly_progress -> ledger: post +250 on approval (Weeks 1–14),
--    drop attendance points entirely (now folded into the weekly award).
create or replace function public.sync_weekly_points_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := 'week:' || new.week_no;
  v_by  uuid := coalesce(new.coach_id, auth.uid());
begin
  -- attendance no longer scores
  delete from public.points_ledger
  where user_id = new.user_id and source = 'attend' and reference = v_ref;

  if new.proof_status = 'approved' and new.week_no between 1 and 14 then
    insert into public.points_ledger (user_id, source, reference, points, awarded_by)
    values (new.user_id, 'task', v_ref, 250, v_by)
    on conflict (user_id, source, reference)
      do update set points = 250, awarded_by = excluded.awarded_by, awarded_at = now();
  else
    delete from public.points_ledger
    where user_id = new.user_id and source = 'task' and reference = v_ref;
  end if;

  return null;
end;
$$;

-- 3. Daily habits -> ledger: each ticked task is +10.
create or replace function public.sync_habit_points_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.points_ledger
    where user_id = old.user_id
      and source = 'habit'
      and reference = 'habit:' || old.day_no || ':' || old.habit_id;
    return old;
  end if;

  insert into public.points_ledger (user_id, source, reference, points, awarded_by)
  values (new.user_id, 'habit', 'habit:' || new.day_no || ':' || new.habit_id, 10, new.user_id)
  on conflict (user_id, source, reference)
    do update set points = 10, awarded_at = now();
  return new;
end;
$$;

drop trigger if exists habit_logs_ledger on public.habit_logs;
create trigger habit_logs_ledger
  after insert or delete on public.habit_logs
  for each row execute function public.sync_habit_points_ledger();

-- 4. Default habit award = 10 / tick.
update public.program_settings set habit_points_per_tick = 10 where id = 1;

-- 5. Backfill existing data to the new model.
delete from public.points_ledger where source = 'attend';

update public.points_ledger set points = 250
  where source = 'task' and split_part(reference, ':', 2)::int between 1 and 14;
delete from public.points_ledger
  where source = 'task' and split_part(reference, ':', 2)::int > 14;

update public.weekly_progress
  set points = case
    when proof_status = 'approved' and week_no between 1 and 14 then 250
    else 0
  end;

update public.habit_logs set points = 10 where points is distinct from 10;
insert into public.points_ledger (user_id, source, reference, points, awarded_by)
  select user_id, 'habit', 'habit:' || day_no || ':' || habit_id, 10, user_id
  from public.habit_logs
  on conflict (user_id, source, reference) do update set points = 10;
