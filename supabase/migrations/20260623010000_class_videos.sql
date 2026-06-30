-- Admin-managed class video per program week.
-- A week's recording can be a YouTube/Vimeo link, a direct .mp4 URL, or an
-- uploaded file (stored in the class-videos bucket). The player auto-detects
-- the kind; class_video_provider is an optional explicit hint.

alter table public.program_weeks
  add column if not exists class_video_url text,
  add column if not exists class_video_provider text,
  add column if not exists class_video_title text;

alter table public.program_weeks
  drop constraint if exists program_weeks_video_provider_chk;
alter table public.program_weeks
  add constraint program_weeks_video_provider_chk
  check (class_video_provider is null or class_video_provider in ('youtube', 'vimeo', 'file'));

-- RLS: any authenticated user may read the curriculum (so participants get the
-- video); only staff may change it.
alter table public.program_weeks enable row level security;

drop policy if exists program_weeks_read on public.program_weeks;
create policy program_weeks_read on public.program_weeks
  for select to authenticated using (true);

drop policy if exists program_weeks_staff_update on public.program_weeks;
create policy program_weeks_staff_update on public.program_weeks
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Public bucket for uploaded class recordings; only staff may write.
insert into storage.buckets (id, name, public)
values ('class-videos', 'class-videos', true)
on conflict (id) do nothing;

drop policy if exists class_videos_read on storage.objects;
create policy class_videos_read on storage.objects
  for select to public using (bucket_id = 'class-videos');

drop policy if exists class_videos_insert on storage.objects;
create policy class_videos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'class-videos' and public.is_staff());

drop policy if exists class_videos_update on storage.objects;
create policy class_videos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'class-videos' and public.is_staff());

drop policy if exists class_videos_delete on storage.objects;
create policy class_videos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'class-videos' and public.is_staff());
