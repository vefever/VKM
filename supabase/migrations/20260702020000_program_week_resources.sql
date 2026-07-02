-- =========================================================
-- PROGRAM WEEK RESOURCES (2026-07-02)
--
-- Downloads / links / files that staff (mentor + admin) attach to a specific
-- week of a specific PROGRAM. Because each batch maps to a program (batches
-- .program_id), this makes weekly resources — and the existing per-week class
-- video on program_weeks — effectively batch-scoped: Batch 16 and a future
-- Batch 17 (on their own programs) get different content, and a participant
-- sees only their batch's program.
-- =========================================================

create table if not exists public.program_week_resources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_no int not null,
  kind text not null default 'file',           -- file | link
  title text not null,
  url text not null,
  file_name text,
  size bigint,
  sort int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pwr_program_week_idx
  on public.program_week_resources (program_id, week_no, sort);

grant select on public.program_week_resources to authenticated;
grant insert, update, delete on public.program_week_resources to authenticated;
grant all on public.program_week_resources to service_role;
alter table public.program_week_resources enable row level security;

-- Curriculum content — readable by any authenticated user (the participant view
-- filters to their own program).
drop policy if exists pwr_select on public.program_week_resources;
create policy pwr_select on public.program_week_resources
  for select to authenticated using (true);

-- Only mentors + admins manage resources.
drop policy if exists pwr_write on public.program_week_resources;
create policy pwr_write on public.program_week_resources
  for all to authenticated
  using (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin'));

do $$
begin
  begin alter publication supabase_realtime add table public.program_week_resources; exception when duplicate_object then null; end;
end $$;
