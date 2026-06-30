-- =========================================================
-- SECURITY FIXES (post-hardening)
-- - Safer bootstrap for first super_admin (existence-based, not count==1)
-- - Storage bucket insert policies: enforce user owns their path prefix
--   Prevents any authenticated user from uploading under another user's folder
--   (affects chat-attachments used for chat, proofs, avatars + vision-board)
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fix auto-admin bootstrap (was using COUNT(*) FROM auth.users which is racy
--    and allows the Nth public signup to become super_admin in some reset scenarios)
--    New logic: the very first user to ever receive a super_admin role wins it.
--    Later public signups always get participant.
--    Elevated roles for staff should be done via invite (which upserts role after).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Existence check is robust (works even after partial resets or many users)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'super_admin' LIMIT 1
  ) INTO has_admin;

  IF NOT has_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'participant');
  END IF;

  RETURN NEW;
END;
$$;

-- Re-assert revokes (idempotent safety)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------
-- 2. Storage policy hardening for user-owned uploads
-- chat-attachments: used by chat, proof-submit (reuses uploadAttachment), avatar uploads
-- vision-board: member vision images
--
-- Existing policies were open INSERT for any authenticated (no path ownership).
-- This allowed cross-user path pollution / abuse.
-- Public read kept (required for sharing previews + vision boards).
-- ---------------------------------------------------------

-- Chat attachments (proofs, chat media, avatars reuse this bucket under uid/...)
DROP POLICY IF EXISTS "chat_attach_insert" ON storage.objects;
CREATE POLICY "chat_attach_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own uploads (good hygiene)
DROP POLICY IF EXISTS "chat_attach_delete_own" ON storage.objects;
CREATE POLICY "chat_attach_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Vision board (user-scoped folders)
DROP POLICY IF EXISTS "vision_img_write" ON storage.objects;
CREATE POLICY "vision_img_write_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vision-board'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vision_img_delete_own" ON storage.objects;
CREATE POLICY "vision_img_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vision-board'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Keep the public read policies that already exist for these buckets (intentional)
-- class-videos already properly restricts writes to is_staff().

-- Note: If you need to allow staff to view/delete any proof/chat for support,
-- you can add an OR public.is_staff() clause later to the USING/WITH CHECK.
