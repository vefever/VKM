-- =========================================================
-- SUPER ADMIN FILES PAGE (2026-07-04)
--
-- Two SECURITY DEFINER functions backing /admin/files — a batch-wise,
-- participant-wise browser over every file a participant has ever uploaded
-- (weekly proofs, daily habit proofs, vision board photos):
--   admin_batch_file_counts(_batch_id)  -> cheap per-participant counts for
--                                          the batch roster list (no payloads)
--   admin_participant_files(_user_id)   -> full grouped file listing for one
--                                          participant's drilldown/zip
--
-- Mirrors the existing single-participant Files tab
-- (src/components/coach/participant-files-tab.tsx), but as one SQL round
-- trip per participant instead of three client hooks — day_no/week_no are
-- stored directly on each row, so no date math is needed to group them.
-- =========================================================

create or replace function public.admin_batch_file_counts(_batch_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  weekly_file_count int,
  habit_file_count int,
  vision_file_count int,
  total_file_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  return query
  with counts as (
    select
      pr.id as user_id,
      pr.full_name,
      pr.avatar_url,
      coalesce((select sum(jsonb_array_length(wp.proof_files)) from weekly_progress wp where wp.user_id = pr.id), 0)::int as weekly_file_count,
      coalesce((select sum(jsonb_array_length(hl.proof_files)) from habit_logs hl where hl.user_id = pr.id), 0)::int as habit_file_count,
      coalesce((select jsonb_array_length(vs.images) from vision_statements vs where vs.user_id = pr.id), 0)::int as vision_file_count
    from batch_members bm
    join profiles pr on pr.id = bm.user_id
    where bm.batch_id = _batch_id and bm.role = 'participant'
  )
  select
    c.user_id, c.full_name, c.avatar_url,
    c.weekly_file_count, c.habit_file_count, c.vision_file_count,
    (c.weekly_file_count + c.habit_file_count + c.vision_file_count) as total_file_count
  from counts c
  order by c.full_name;
end;
$$;
revoke all on function public.admin_batch_file_counts(uuid) from anon, public;
grant execute on function public.admin_batch_file_counts(uuid) to authenticated;

create or replace function public.admin_participant_files(_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  select jsonb_build_object(
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object('week_no', wp.week_no, 'files', wp.proof_files) order by wp.week_no), '[]'::jsonb)
      from weekly_progress wp
      where wp.user_id = _user_id and jsonb_array_length(wp.proof_files) > 0
    ),
    'habits', (
      select coalesce(jsonb_agg(jsonb_build_object('day_no', t.day_no, 'items', t.items) order by t.day_no desc), '[]'::jsonb)
      from (
        select
          hl.day_no,
          jsonb_agg(jsonb_build_object('habit_id', hl.habit_id, 'files', hl.proof_files) order by hl.habit_id) as items
        from habit_logs hl
        where hl.user_id = _user_id and jsonb_array_length(hl.proof_files) > 0
        group by hl.day_no
      ) t
    ),
    'vision', coalesce((select vs.images from vision_statements vs where vs.user_id = _user_id), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.admin_participant_files(uuid) from anon, public;
grant execute on function public.admin_participant_files(uuid) to authenticated;
