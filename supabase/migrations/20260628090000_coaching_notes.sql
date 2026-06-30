-- =========================================================
-- Phase 4: track the coaching itself. A private 1:1 log per participant —
-- coaches record what was covered + the next commitment. STAFF-ONLY: participants
-- never see these notes (no participant RLS path). Authors (or super_admin) edit.
-- =========================================================

create table if not exists public.coaching_notes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  next_step text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists coaching_notes_participant_idx
  on public.coaching_notes (participant_id, occurred_at desc);

grant select, insert, update, delete on public.coaching_notes to authenticated;
grant all on public.coaching_notes to service_role;
alter table public.coaching_notes enable row level security;

-- Read: staff only (coach / mentor / super_admin). Participants are excluded.
drop policy if exists cn_staff_read on public.coaching_notes;
create policy cn_staff_read on public.coaching_notes
  for select to authenticated using (public.is_staff());

-- Insert: staff logging their own note.
drop policy if exists cn_insert on public.coaching_notes;
create policy cn_insert on public.coaching_notes
  for insert to authenticated
  with check (public.is_staff() and coach_id = auth.uid());

-- Edit / delete: the author, or a super admin.
drop policy if exists cn_update on public.coaching_notes;
create policy cn_update on public.coaching_notes
  for update to authenticated
  using (coach_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  with check (coach_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists cn_delete on public.coaching_notes;
create policy cn_delete on public.coaching_notes
  for delete to authenticated
  using (coach_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
