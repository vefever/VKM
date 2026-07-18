-- Allow Google Drive as a weekly class-video source.
--
-- The original constraint (20260623010000) predates Drive support and only
-- permitted ('youtube','vimeo','file'). Pasting a Drive link into a week's
-- class video therefore FAILED at the database level — the provider detected
-- from the URL is 'drive', which the check rejected. That is why Drive links
-- "were not supported" on the weekly lessons.
--
-- Widen it to the full VideoKind set so every source the player can render is
-- storable: youtube | vimeo | drive | file. ('link' is included as a tolerant
-- catch-all for any other third-party URL saved by older/other code paths.)

alter table public.program_weeks
  drop constraint if exists program_weeks_video_provider_chk;
alter table public.program_weeks
  add constraint program_weeks_video_provider_chk
  check (
    class_video_provider is null
    or class_video_provider in ('youtube', 'vimeo', 'drive', 'file', 'link')
  );
