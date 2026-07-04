-- =========================================================
-- CLASS VIDEO THUMBNAILS (2026-07-06)
--
-- A custom "poster" image shown before a class video plays (YouTube-style).
-- YouTube URLs auto-derive a thumbnail client-side; this column stores an
-- admin-uploaded custom thumbnail (needed for uploaded .mp4 / Vimeo, or to
-- override the YouTube one). Lives on program_weeks next to the other
-- class_video_* columns, so it's program/batch-scoped and copied by clones.
-- =========================================================

alter table public.program_weeks
  add column if not exists class_video_thumbnail text;

-- Recreate clone_program to also copy the thumbnail column (return type
-- unchanged, so create-or-replace is fine).
create or replace function public.clone_program(
  _source uuid,
  _new_title text,
  _status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
begin
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
    raise exception 'Forbidden: mentor or super admin only';
  end if;
  if _source is null then
    raise exception 'Source program is required';
  end if;

  insert into public.programs (title, description, duration_weeks, status, created_by)
  select coalesce(nullif(trim(_new_title), ''), p.title || ' (copy)'),
         p.description, p.duration_weeks, coalesce(nullif(_status, ''), 'active'), auth.uid()
  from public.programs p
  where p.id = _source
  returning id into v_new;

  if v_new is null then
    raise exception 'Source program not found';
  end if;

  insert into public.program_weeks
    (program_id, week_no, phase, topic, mode, why, task, proof,
     class_video_url, class_video_provider, class_video_title, class_video_thumbnail)
  select v_new, week_no, phase, topic, mode, why, task, proof,
     class_video_url, class_video_provider, class_video_title, class_video_thumbnail
  from public.program_weeks
  where program_id = _source;

  insert into public.milestones
    (program_id, code, name, unlock_week, cost_inr, reward_items, handover)
  select v_new, code, name, unlock_week, cost_inr, reward_items, handover
  from public.milestones
  where program_id = _source;

  insert into public.program_week_resources
    (program_id, week_no, kind, title, url, file_name, size, sort, created_by)
  select v_new, week_no, kind, title, url, file_name, size, sort, auth.uid()
  from public.program_week_resources
  where program_id = _source;

  return v_new;
end;
$$;
revoke all on function public.clone_program(uuid, text, text) from anon, public;
grant execute on function public.clone_program(uuid, text, text) to authenticated;
