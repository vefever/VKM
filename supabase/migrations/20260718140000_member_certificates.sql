-- =========================================================
-- MEMBER CERTIFICATES — staff-issued completion certificates (2026-07-18)
--
-- Staff (coach / mentor / admin) upload a finished certificate file (PDF or
-- image) for ONE specific member. Issuing the certificate IS the unlock: the
-- member sees, previews and downloads it from their Certificates page as soon
-- as staff upload it, and sees the locked "unlocks after course completion"
-- state until then. Mirrors member_session_videos: pure content, RLS-scoped,
-- no points or triggers.
-- =========================================================

create table if not exists public.member_certificates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  file_url   text not null,
  file_type  text,                                   -- application/pdf | image/png | image/jpeg
  note       text,
  issued_at  timestamptz not null default now(),
  is_active  boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists mc_user_idx on public.member_certificates (user_id, issued_at desc);

alter table public.member_certificates enable row level security;
revoke all on public.member_certificates from anon;
grant select, insert, update, delete on public.member_certificates to authenticated;
grant all on public.member_certificates to service_role;

-- A member reads their own certificates; staff (coach/mentor/admin) manage any.
drop policy if exists mc_read on public.member_certificates;
create policy mc_read on public.member_certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists mc_insert on public.member_certificates;
create policy mc_insert on public.member_certificates
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists mc_update on public.member_certificates;
create policy mc_update on public.member_certificates
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists mc_delete on public.member_certificates;
create policy mc_delete on public.member_certificates
  for delete to authenticated
  using (public.is_staff());
