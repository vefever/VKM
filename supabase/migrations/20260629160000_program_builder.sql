-- =========================================================
-- PROGRAM BUILDER (2026-06-29)
-- Make the week plan editable + variable-length. The program_weeks table already
-- exists (read-all, staff-modify); admins edit it via the Program Builder. Adds
-- and content-edits go through normal RLS-checked client writes; deletes need a
-- renumber to keep weeks contiguous (1..N), which this RPC does atomically.
--
-- Program length = number of program_weeks rows for the active program. Each
-- participant's clock still starts the day THEY press Start (program_enrollments
-- .started_at), so length changes apply to everyone, per their own start date.
-- =========================================================

-- Delete a week and close the gap so week numbers stay contiguous. Also keeps
-- programs.duration_weeks and any over-long enrollment lengths in sync.
create or replace function public.admin_delete_program_week(_program_id uuid, _week_no int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not (public.has_role(auth.uid(), 'mentor') or public.has_role(auth.uid(), 'super_admin')) then
    raise exception 'Forbidden: staff only';
  end if;

  delete from public.program_weeks where program_id = _program_id and week_no = _week_no;
  -- Shift every later week down by one to remove the gap.
  update public.program_weeks
     set week_no = week_no - 1
   where program_id = _program_id and week_no > _week_no;

  select count(*) into v_count from public.program_weeks where program_id = _program_id;
  update public.programs set duration_weeks = v_count, updated_at = now() where id = _program_id;
  update public.program_enrollments set total_weeks = v_count where total_weeks > v_count;

  return v_count;
end;
$$;
revoke execute on function public.admin_delete_program_week(uuid, int) from anon, public;
grant execute on function public.admin_delete_program_week(uuid, int) to authenticated;
