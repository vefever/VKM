-- =========================================================
-- Community contact details (2026-07-02)
--
-- Expose email + phone for members who've made their community profile public,
-- so peers can reach out. Email lives in auth.users and phone on profiles —
-- both are otherwise not peer-readable — so surface them via a SECURITY DEFINER
-- function scoped to public member profiles only.
-- =========================================================

create or replace function public.get_community_contact()
returns table (
  user_id uuid,
  email text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select mp.user_id, au.email::text, p.phone
  from public.member_profiles mp
  join auth.users au on au.id = mp.user_id
  left join public.profiles p on p.id = mp.user_id
  where mp.is_public = true;
$$;
revoke execute on function public.get_community_contact() from anon, public;
grant execute on function public.get_community_contact() to authenticated;
