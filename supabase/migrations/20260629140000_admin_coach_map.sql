-- Coach-assignment lookup for the admin User Management table: maps each
-- assigned participant's email to their coach's name/email so the directory can
-- show an "Assigned coach" column. Super-admin only.
create or replace function public.admin_coach_map()
returns table (participant_email text, coach_name text, coach_email text)
language sql
stable
security definer
set search_path = public
as $$
  select pu.email, cp.full_name, cu.email
  from public.coach_assignments ca
  join auth.users pu on pu.id = ca.participant_id
  left join public.profiles cp on cp.id = ca.coach_id
  left join auth.users cu on cu.id = ca.coach_id
  where public.has_role(auth.uid(), 'super_admin');
$$;

revoke execute on function public.admin_coach_map() from anon, public;
grant execute on function public.admin_coach_map() to authenticated;
