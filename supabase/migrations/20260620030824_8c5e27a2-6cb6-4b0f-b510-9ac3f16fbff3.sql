
-- 1. profiles flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

-- 2. invites table
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  role app_role NOT NULL,
  phone text,
  batch text,
  token text NOT NULL UNIQUE,
  temp_password text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invites_email_idx ON public.user_invites (lower(email));
CREATE INDEX IF NOT EXISTS user_invites_status_idx ON public.user_invites (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO authenticated;
GRANT SELECT ON public.user_invites TO anon;
GRANT ALL ON public.user_invites TO service_role;

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Admin manage
CREATE POLICY "Admins manage invites"
  ON public.user_invites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Public read by token (for /invite/:token page) — restrict to non-revoked, non-expired
CREATE POLICY "Anyone can read pending invite to claim"
  ON public.user_invites FOR SELECT
  TO anon, authenticated
  USING (status = 'pending' AND revoked_at IS NULL AND expires_at > now());

-- Trigger updated_at
CREATE TRIGGER set_user_invites_updated_at
  BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. accept_invite function — called by signed-in user after they log in with temp password
CREATE OR REPLACE FUNCTION public.accept_invite_by_token(_token text)
RETURNS public.user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.user_invites;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE token = _token
    AND status = 'pending'
    AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, expired, or already used';
  END IF;

  UPDATE public.user_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_uid
  WHERE id = v_invite.id
  RETURNING * INTO v_invite;

  -- Ensure role row exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Force reset on first login
  UPDATE public.profiles
  SET must_reset_password = true
  WHERE id = v_uid;

  RETURN v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite_by_token(text) TO authenticated;
