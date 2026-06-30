-- =========================================================
-- PUBLIC INVITE LOOKUP (2026-06-30)
-- The /invite/:token landing page runs for a NOT-yet-signed-in visitor, so it
-- can't read user_invites under RLS. Previously the server function used the
-- service-role key to bypass RLS — which means the public invite page silently
-- breaks ("Invite unavailable") whenever that secret is missing from the worker
-- runtime, and couples a public page to the admin secret.
--
-- Fix: a SECURITY DEFINER function granted to `anon` that, given the (secret,
-- 256-bit) token, returns ONLY non-sensitive invite fields — never the
-- temp_password or the token itself. Possession of the token already implies
-- the visitor was sent this invite, so exposing name/email/role to them is the
-- same trust boundary as the email they received.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_invite_public(_token text)
RETURNS TABLE (
  email text,
  name text,
  role public.app_role,
  batch text,
  expires_at timestamptz,
  status text,
  is_revoked boolean,
  is_expired boolean,
  is_usable boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email,
    i.name,
    i.role,
    i.batch,
    i.expires_at,
    i.status,
    (i.revoked_at IS NOT NULL)                                                AS is_revoked,
    (i.expires_at <= now())                                                   AS is_expired,
    (i.status = 'pending' AND i.revoked_at IS NULL AND i.expires_at > now())  AS is_usable
  FROM public.user_invites i
  WHERE i.token = _token
  LIMIT 1;
$$;

-- Callable by an unauthenticated visitor (anon) and by signed-in users.
REVOKE EXECUTE ON FUNCTION public.get_invite_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_public(text) TO anon, authenticated;
