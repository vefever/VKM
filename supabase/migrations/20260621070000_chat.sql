-- =========================================================
-- CHAT — participant ↔ staff (coach / mentor / admin), realtime,
-- with file/image/video attachments via Storage.
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'coach')
      OR public.has_role(auth.uid(), 'mentor')
      OR public.has_role(auth.uid(), 'super_admin');
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- One support thread per participant; any staff member can join & reply.
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated USING (participant_id = auth.uid() OR public.is_staff());
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (participant_id = auth.uid() OR public.is_staff());
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE TO authenticated USING (participant_id = auth.uid() OR public.is_staff());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR conversation_id IN (SELECT id FROM public.conversations WHERE participant_id = auth.uid())
  );
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_staff()
      OR conversation_id IN (SELECT id FROM public.conversations WHERE participant_id = auth.uid())
    )
  );

-- Keep conversations sorted by recent activity.
CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Storage bucket for attachments (public read, authenticated upload).
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_attach_read" ON storage.objects;
CREATE POLICY "chat_attach_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attach_insert" ON storage.objects;
CREATE POLICY "chat_attach_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
