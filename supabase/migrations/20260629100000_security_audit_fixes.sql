-- =========================================================
-- SECURITY AUDIT FIXES (2026-06-29)
-- - CRITICAL: accept_invite_by_token leaked temp_password + token to any authed user
-- - HIGH:     meetings.start_url (host-only Zoom URL) readable by participants via SELECT *
-- - HIGH:     profiles RLS blocked legitimate display-name lookups (community/meetings/chat)
--             without exposing phone/PII — added get_profiles_display() SECURITY DEFINER RPC
-- =========================================================

-- ---------------------------------------------------------
-- 1. Safe invite acceptance — bind to signed-in email, redact secrets
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS public.accept_invite_by_token(text);

CREATE OR REPLACE FUNCTION public.accept_invite_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.user_invites;
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR trim(v_email) = '' THEN
    RAISE EXCEPTION 'Signed-in account has no email';
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

  IF lower(trim(v_invite.email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'This invite was issued to a different email address';
  END IF;

  UPDATE public.user_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_uid,
      temp_password = '[cleared]'
  WHERE id = v_invite.id
  RETURNING * INTO v_invite;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET must_reset_password = true
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'email', v_invite.email,
    'name', v_invite.name,
    'role', v_invite.role,
    'status', v_invite.status,
    'accepted_at', v_invite.accepted_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invite_by_token(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite_by_token(text) TO authenticated;

-- ---------------------------------------------------------
-- 2. Column-level lock on meetings.start_url (host-only Zoom URL)
--    Client joins via Meeting SDK signature — start_url is never needed in-browser.
-- ---------------------------------------------------------
REVOKE SELECT ON public.meetings FROM authenticated;
GRANT SELECT (
  id,
  zoom_meeting_id,
  topic,
  host_id,
  participant_id,
  batch_id,
  start_time,
  duration_min,
  join_url,
  password,
  status,
  created_at
) ON public.meetings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.meetings TO authenticated;

-- ---------------------------------------------------------
-- 3. Curated profile display names — no phone, no enumeration of private users
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profiles_display(_ids uuid[])
RETURNS TABLE (id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      -- Staff callers can resolve any requested profile (coach dashboards, etc.)
      public.is_staff()
      -- Always see yourself
      OR p.id = auth.uid()
      -- Participants may see staff names (coaching support, meetings)
      OR public.has_role(p.id, 'coach')
      OR public.has_role(p.id, 'mentor')
      OR public.has_role(p.id, 'super_admin')
      -- Public member-directory opt-in
      OR EXISTS (
        SELECT 1 FROM public.member_profiles mp
        WHERE mp.user_id = p.id AND mp.is_public = true
      )
      -- Cohort / batch peers
      OR EXISTS (
        SELECT 1
        FROM public.batch_members bm_self
        JOIN public.batch_members bm_peer ON bm_self.batch_id = bm_peer.batch_id
        WHERE bm_self.user_id = auth.uid() AND bm_peer.user_id = p.id
      )
      -- Peer DMs
      OR EXISTS (
        SELECT 1 FROM public.dm_threads t
        WHERE auth.uid() IN (t.user_lo, t.user_hi)
          AND p.id IN (t.user_lo, t.user_hi)
      )
      -- Scheduled meetings you are part of
      OR EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE auth.uid() IN (m.host_id, m.participant_id)
          AND p.id IN (m.host_id, m.participant_id)
      )
      -- Coaching-support thread counterparts
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.messages msg ON msg.conversation_id = c.id
        WHERE c.participant_id = auth.uid()
          AND (msg.sender_id = p.id OR p.id = auth.uid())
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_display(uuid[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_display(uuid[]) TO authenticated;