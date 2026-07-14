-- =========================================================
-- MEMBER SESSION VIDEOS — per-member 1-on-1 weekly videos (2026-07-08)
--
-- Staff attach session videos to ONE specific member, optionally tagged to a
-- program week (1-16). The member sees only their own. Sources: a pasted link
-- (Google Drive / YouTube / Vimeo / any URL) or an uploaded file (R2). No points
-- or triggers — purely content, RLS-scoped.
-- =========================================================

create table if not exists public.member_session_videos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_no    int check (week_no between 1 and 52),   -- null = general / unscoped
  title      text,
  video_url  text not null,
  provider   text,                                   -- youtube | vimeo | drive | file | link
  note       text,
  is_active  boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists msv_user_week_idx on public.member_session_videos (user_id, week_no);

alter table public.member_session_videos enable row level security;
revoke all on public.member_session_videos from anon;
grant select, insert, update, delete on public.member_session_videos to authenticated;
grant all on public.member_session_videos to service_role;

-- A member reads their own active videos; staff (coach/mentor/admin) manage any.
drop policy if exists msv_read on public.member_session_videos;
create policy msv_read on public.member_session_videos
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists msv_insert on public.member_session_videos;
create policy msv_insert on public.member_session_videos
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists msv_update on public.member_session_videos;
create policy msv_update on public.member_session_videos
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists msv_delete on public.member_session_videos;
create policy msv_delete on public.member_session_videos
  for delete to authenticated
  using (public.is_staff());
