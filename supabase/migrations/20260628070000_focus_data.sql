-- =========================================================
-- Persist Today's Focus to the database (was localStorage-only, so coaches
-- couldn't see it). Now it's a real source of truth with staff-read RLS, which
-- unblocks surfacing engagement on the coach side and an "active today" signal.
-- =========================================================

-- Deep-work timer sessions (one row per completed session).
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes int not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists focus_sessions_user_idx on public.focus_sessions (user_id, created_at desc);
grant select, insert, delete on public.focus_sessions to authenticated;
grant all on public.focus_sessions to service_role;
alter table public.focus_sessions enable row level security;

drop policy if exists fs_own on public.focus_sessions;
create policy fs_own on public.focus_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists fs_staff_read on public.focus_sessions;
create policy fs_staff_read on public.focus_sessions
  for select to authenticated using (public.is_staff());

-- Today's editable action checklist (one row per action per day).
create table if not exists public.daily_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_date date not null default current_date,
  text text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists daily_actions_user_date_idx on public.daily_actions (user_id, action_date);
grant select, insert, update, delete on public.daily_actions to authenticated;
grant all on public.daily_actions to service_role;
alter table public.daily_actions enable row level security;

drop policy if exists da_own on public.daily_actions;
create policy da_own on public.daily_actions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists da_staff_read on public.daily_actions;
create policy da_staff_read on public.daily_actions
  for select to authenticated using (public.is_staff());
