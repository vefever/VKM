-- Inline + bulk coach assignment for the admin User Management table.
-- 1) admin_coach_map gains coach_id so the inline <Select> can show the current
--    value. 2) admin_bulk_assign_coach assigns/unassigns many participants
--    (by email) to one coach in a single round-trip. Both super-admin only.

drop function if exists public.admin_coach_map();
create or replace function public.admin_coach_map()
returns table (participant_email text, coach_id uuid, coach_name text, coach_email text)
language sql
stable
security definer
set search_path = public
as $$
  select pu.email, ca.coach_id, cp.full_name, cu.email
  from public.coach_assignments ca
  join auth.users pu on pu.id = ca.participant_id
  left join public.profiles cp on cp.id = ca.coach_id
  left join auth.users cu on cu.id = ca.coach_id
  where public.has_role(auth.uid(), 'super_admin');
$$;
revoke execute on function public.admin_coach_map() from anon, public;
grant execute on function public.admin_coach_map() to authenticated;

-- Bulk assign (or unassign when _coach_id is null) by participant email.
create or replace function public.admin_bulk_assign_coach(_emails text[], _coach_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden: super admin only';
  end if;

  if _coach_id is null then
    delete from public.coach_assignments ca
    using auth.users u
    where ca.participant_id = u.id
      and lower(u.email) = any (select lower(e) from unnest(_emails) e);
    get diagnostics n = row_count;
  else
    insert into public.coach_assignments (participant_id, coach_id, assigned_by, assigned_at)
    select u.id, _coach_id, auth.uid(), now()
    from auth.users u
    where lower(u.email) = any (select lower(e) from unnest(_emails) e)
    on conflict (participant_id)
      do update set coach_id = excluded.coach_id, assigned_by = excluded.assigned_by, assigned_at = now();
    get diagnostics n = row_count;
  end if;

  return n;
end;
$$;
revoke execute on function public.admin_bulk_assign_coach(text[], uuid) from anon, public;
grant execute on function public.admin_bulk_assign_coach(text[], uuid) to authenticated;
