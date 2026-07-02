-- =========================================================
-- Community business auto-fetch (2026-07-02)
--
-- The community directory should show each member's real business details from
-- their business profile (business_brains / My Business), not a separately
-- typed copy. business_brains is owner/staff-only under RLS, so expose ONLY the
-- safe, public-facing fields (no revenue/financials) for members who have opted
-- their community profile public, via a SECURITY DEFINER function.
-- =========================================================

create or replace function public.get_community_business()
returns table (
  user_id uuid,
  business_name text,
  industry text,
  location text,
  website text,
  usp text,
  logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select bb.user_id, bb.business_name, bb.industry, bb.location, bb.website, bb.usp, bb.logo_url
  from public.business_brains bb
  join public.member_profiles mp on mp.user_id = bb.user_id and mp.is_public = true;
$$;
revoke execute on function public.get_community_business() from anon, public;
grant execute on function public.get_community_business() to authenticated;
