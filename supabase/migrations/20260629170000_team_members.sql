-- =========================================================
-- TEAM MEMBERS (2026-06-29)
-- Per-business team roster for the participant's "My Business" page. The owner
-- manages their own team; their assigned coach / mentor / super_admin can read
-- it (via coaches_participant) for coaching context.
-- =========================================================

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- the business owner
  name text not null,
  role text,
  department text,
  email text,
  phone text,
  monthly_salary_inr bigint,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_members_user_idx on public.team_members(user_id);

grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;

-- Read: the owner, or a coach/mentor/admin scoped to this participant.
drop policy if exists tm_select on public.team_members;
create policy tm_select on public.team_members
  for select to authenticated using (
    user_id = auth.uid() or public.coaches_participant(user_id)
  );

-- Write: the owner manages their own roster.
drop policy if exists tm_insert on public.team_members;
create policy tm_insert on public.team_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists tm_update on public.team_members;
create policy tm_update on public.team_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tm_delete on public.team_members;
create policy tm_delete on public.team_members
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists team_members_updated_at on public.team_members;
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();
