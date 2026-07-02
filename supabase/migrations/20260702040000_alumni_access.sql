-- =========================================================
-- Alumni + access tiers (2026-07-02)
--
-- Participant access is tiered by batch status + an alumni flag:
--   • active/upcoming batch  → full participant app
--   • all batches completed  → Community only (past cohort)
--   • alumni (flag)          → Community + My Business + Support + Settings
-- The flag lives on profiles; batch "past" is batches.status = 'completed'.
-- Gating is applied in the app (nav + route guard); RLS still protects data.
-- =========================================================

alter table public.profiles
  add column if not exists is_alumni boolean not null default false;

-- Staff-only setter (admins/mentors) — participants can't self-promote, and the
-- profiles RLS only lets a user update their OWN row, so this bypasses via
-- SECURITY DEFINER for staff.
create or replace function public.admin_set_alumni(_user_id uuid, _value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'mentor')) then
    raise exception 'Forbidden: staff only';
  end if;
  update public.profiles set is_alumni = _value, updated_at = now() where id = _user_id;
end;
$$;
revoke execute on function public.admin_set_alumni(uuid, boolean) from anon, public;
grant execute on function public.admin_set_alumni(uuid, boolean) to authenticated;
