-- =========================================================
-- PROGRAM ENROLLMENT — each participant runs their OWN 16-week (or custom-length)
-- clock that begins the day THEY press "Start Program". This replaces a single
-- shared cohort start date so people who join mid-week start fresh from week 1.
-- =========================================================

create table if not exists public.program_enrollments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz, -- null until the participant starts
  total_weeks int not null default 16, -- customizable program length
  status text not null default 'not_started', -- not_started | active | completed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.program_enrollments to authenticated;
grant all on public.program_enrollments to service_role;
alter table public.program_enrollments enable row level security;

-- A participant sees & manages their own enrollment; staff can see/manage all
-- (so a coach can start the program for someone or set a custom length).
drop policy if exists pe_select on public.program_enrollments;
create policy pe_select on public.program_enrollments
  for select to authenticated
  using (auth.uid() = user_id or public.is_staff());

drop policy if exists pe_insert on public.program_enrollments;
create policy pe_insert on public.program_enrollments
  for insert to authenticated
  with check (auth.uid() = user_id or public.is_staff());

drop policy if exists pe_update on public.program_enrollments;
create policy pe_update on public.program_enrollments
  for update to authenticated
  using (auth.uid() = user_id or public.is_staff())
  with check (auth.uid() = user_id or public.is_staff());
