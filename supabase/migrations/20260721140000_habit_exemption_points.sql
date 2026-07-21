-- Award full-day habit points for an APPROVED exemption, so an excused day
-- counts exactly like a completed 6/6 day (and the streak-bridge on the client
-- now increments too). Idempotent via the points_ledger (user_id, source,
-- reference) unique key; the points vanish again if the exemption is later
-- un-approved, rejected, or deleted.
--
-- Points = 6 habits × the configured per-habit award (matches sync_habit_points_
-- ledger, which awards `habit_points_per_tick` per habit).

create or replace function public.sync_habit_exemption_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pts int;
begin
  v_pts := 6 * coalesce((select habit_points_per_tick from public.program_settings where id = 1), 10);

  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      delete from public.points_ledger
      where user_id = old.user_id and source = 'habit' and reference = 'exempt:' || old.day_no;
    end if;
    return old;
  end if;

  if new.status = 'approved' then
    insert into public.points_ledger (user_id, source, reference, points, awarded_by)
    values (new.user_id, 'habit', 'exempt:' || new.day_no, v_pts, coalesce(new.reviewed_by, auth.uid()))
    on conflict (user_id, source, reference)
      do update set points = excluded.points, awarded_at = now();
  else
    -- pending or rejected → never leave points behind
    delete from public.points_ledger
    where user_id = new.user_id and source = 'habit' and reference = 'exempt:' || new.day_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_habit_exemption_points on public.habit_exemptions;
create trigger trg_sync_habit_exemption_points
  after insert or update or delete on public.habit_exemptions
  for each row execute function public.sync_habit_exemption_points();

-- Backfill: award points for any already-approved exemptions.
insert into public.points_ledger (user_id, source, reference, points, awarded_by)
select e.user_id, 'habit', 'exempt:' || e.day_no,
       6 * coalesce((select habit_points_per_tick from public.program_settings where id = 1), 10),
       coalesce(e.reviewed_by, e.user_id)
from public.habit_exemptions e
where e.status = 'approved'
on conflict (user_id, source, reference) do update set points = excluded.points;
