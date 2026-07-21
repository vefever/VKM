-- =========================================================
-- HABIT EXEMPTIONS — "special request" for a missed habit day (2026-07-21)
--
-- Daily habits are mandatory that day. When a participant genuinely can't log
-- (fever, health, travel…), they request an exemption for that specific day and
-- send it to staff. An APPROVED exemption "regulates" the day: it bridges the
-- streak (doesn't break it) and shows in a distinct colour on the habit grid.
--
-- Rules:
--   • Max 3 per calendar month (pending + approved count toward the cap;
--     rejected requests free the slot).
--   • Participants create pending requests for THEIR OWN missed days and may
--     cancel a still-pending one. Only staff (coach/mentor/admin) approve/reject.
--   • Regulation is applied client-side in the streak/grid from approved rows.
-- =========================================================

create table if not exists public.habit_exemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_no      int  not null check (day_no >= 1),        -- program day being excused
  exempt_date date not null,                            -- calendar date (month quota + display)
  reason      text not null,                            -- fever | health | travel | family | other
  note        text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, day_no)                              -- one request per day
);
create index if not exists habit_exemptions_user_idx on public.habit_exemptions (user_id, status);

alter table public.habit_exemptions enable row level security;
revoke all on public.habit_exemptions from anon;
grant select, insert, update, delete on public.habit_exemptions to authenticated;
grant all on public.habit_exemptions to service_role;

-- Read: own, or any staff.
drop policy if exists hx_read on public.habit_exemptions;
create policy hx_read on public.habit_exemptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Insert: only for yourself (the guard trigger forces status='pending').
drop policy if exists hx_insert on public.habit_exemptions;
create policy hx_insert on public.habit_exemptions
  for insert to authenticated
  with check (user_id = auth.uid());

-- Update: staff approve/reject anyone. (Participants don't edit — they cancel
-- by deleting a pending row.)
drop policy if exists hx_update on public.habit_exemptions;
create policy hx_update on public.habit_exemptions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Delete: a participant may cancel their OWN pending request; staff may remove any.
drop policy if exists hx_delete on public.habit_exemptions;
create policy hx_delete on public.habit_exemptions
  for delete to authenticated
  using (public.is_staff() or (user_id = auth.uid() and status = 'pending'));

-- ---------------------------------------------------------
-- Guard: force self-service rows to pending; enforce the monthly cap; stamp the
-- reviewer on approve/reject.
-- ---------------------------------------------------------
create or replace function public.guard_habit_exemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if TG_OP = 'INSERT' then
    -- A participant can never self-approve.
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;

    -- Monthly cap: at most 3 non-rejected in the exemption's calendar month.
    select count(*) into v_count
    from public.habit_exemptions e
    where e.user_id = new.user_id
      and e.status in ('pending', 'approved')
      and date_trunc('month', e.exempt_date) = date_trunc('month', new.exempt_date);
    if v_count >= 3 then
      raise exception 'Monthly exemption limit reached (3 per month).'
        using errcode = 'check_violation';
    end if;

  elsif TG_OP = 'UPDATE' then
    if new.status is distinct from old.status then
      -- Stamp the reviewer (only staff can reach here via RLS).
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      -- Re-approving must not push approved past 3 in that month.
      if new.status = 'approved' and old.status <> 'approved' then
        select count(*) into v_count
        from public.habit_exemptions e
        where e.user_id = new.user_id
          and e.status = 'approved'
          and e.id <> new.id
          and date_trunc('month', e.exempt_date) = date_trunc('month', new.exempt_date);
        if v_count >= 3 then
          raise exception 'This member already has 3 approved exemptions this month.'
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_habit_exemption on public.habit_exemptions;
create trigger trg_guard_habit_exemption
  before insert or update on public.habit_exemptions
  for each row execute function public.guard_habit_exemption();

-- ---------------------------------------------------------
-- Notify: new request → the participant's coaches; decision → the participant.
-- ---------------------------------------------------------
create or replace function public.notify_habit_exemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if TG_OP = 'INSERT' then
    select coalesce(full_name, 'A participant') into v_name from public.profiles where id = new.user_id;
    -- Tell each assigned coach (fallback: all mentors + admins if unassigned).
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    select ca.coach_id, 'assignment',
           'Habit exemption request',
           v_name || ' asked to excuse Day ' || new.day_no || ' (' || new.reason || ').',
           '/coach/approve', new.user_id
    from public.coach_assignments ca
    where ca.participant_id = new.user_id;

    if not exists (select 1 from public.coach_assignments where participant_id = new.user_id) then
      insert into public.notifications (user_id, type, title, body, link, actor_id)
      select ur.user_id, 'assignment',
             'Habit exemption request',
             v_name || ' asked to excuse Day ' || new.day_no || ' (' || new.reason || ').',
             '/coach/approve', new.user_id
      from public.user_roles ur
      where ur.role in ('mentor', 'super_admin');
    end if;

  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status
        and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (
      new.user_id,
      'system',
      case when new.status = 'approved'
           then 'Day ' || new.day_no || ' exemption approved ✓'
           else 'Day ' || new.day_no || ' exemption declined' end,
      case when new.status = 'approved'
           then 'Your missed day is excused — your streak is protected.'
           else 'Your exemption request wasn''t approved this time.' end,
      '/participant/habits',
      auth.uid()
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_notify_habit_exemption on public.habit_exemptions;
create trigger trg_notify_habit_exemption
  after insert or update on public.habit_exemptions
  for each row execute function public.notify_habit_exemption();
