-- Chat messages now raise notifications.
--
-- The chat itself was already realtime, but nothing ever wrote a notification
-- for a message — so unless you happened to be sitting on the Messages page you
-- had no idea anyone had written to you. The bell and its badge had nothing to
-- show.
--
-- Done as triggers rather than in the client so it holds regardless of which
-- surface sent the message, and so it is atomic with the insert: a message that
-- exists always has its notification.
--
-- COALESCING: Messenger does not raise a fresh alert per message. If an unread
-- alert from the same sender already exists it is refreshed in place rather than
-- stacked, so a 20-message burst stays one notification — and this table does
-- not become the largest one again.

-- Shared writer: one recipient, coalesced.
CREATE OR REPLACE FUNCTION public.push_message_notification(
  _recipient uuid,
  _sender    uuid,
  _title     text,
  _preview   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_path text;
BEGIN
  IF _recipient IS NULL OR _recipient = _sender THEN
    RETURN;
  END IF;

  -- Each portal has its own chat route; send people to the one they can open.
  link_path := CASE
    WHEN public.has_role(_recipient, 'super_admin') THEN '/admin/chat'
    WHEN public.has_role(_recipient, 'mentor')      THEN '/mentor/chat'
    WHEN public.has_role(_recipient, 'coach')       THEN '/coach/chat'
    ELSE '/participant/chat'
  END;

  UPDATE notifications
     SET title = _title, body = _preview, link = link_path, created_at = now()
   WHERE user_id = _recipient
     AND type = 'message'
     AND actor_id = _sender
     AND read = false;

  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, type, title, body, link, actor_id, read)
    VALUES (_recipient, 'message', _title, _preview, link_path, _sender, false);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.push_message_notification(uuid, uuid, text, text) FROM anon, authenticated;

-- Sender's display name + a trimmed preview, shared by both triggers.
CREATE OR REPLACE FUNCTION public.message_preview(_sender uuid, _body text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY[
    coalesce((SELECT nullif(trim(full_name), '') FROM profiles WHERE id = _sender), 'New message'),
    CASE
      WHEN nullif(trim(coalesce(_body, '')), '') IS NULL THEN 'Sent an attachment'
      WHEN length(_body) > 140 THEN left(_body, 137) || '...'
      ELSE _body
    END
  ];
$$;

-- ---------------------------------------------------------------------------
-- Coaching thread (public.messages)
-- Staff writing -> notify the participant. Participant writing -> notify the
-- coaches actually assigned to them, so a message doesn't alert every coach.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_coach_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts     text[];
  owner_id  uuid;
  r         uuid;
BEGIN
  parts := public.message_preview(NEW.sender_id, NEW.body);

  SELECT participant_id INTO owner_id
    FROM conversations WHERE id = NEW.conversation_id;
  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = owner_id THEN
    FOR r IN SELECT coach_id FROM coach_assignments WHERE participant_id = owner_id LOOP
      PERFORM public.push_message_notification(r, NEW.sender_id, parts[1], parts[2]);
    END LOOP;
  ELSE
    PERFORM public.push_message_notification(owner_id, NEW.sender_id, parts[1], parts[2]);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_coach_message ON public.messages;
CREATE TRIGGER trg_notify_new_coach_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_coach_message();

-- ---------------------------------------------------------------------------
-- Member DMs (public.dm_messages) — notify the other side of the thread.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
  other uuid;
BEGIN
  parts := public.message_preview(NEW.sender_id, NEW.body);

  SELECT CASE WHEN user_lo = NEW.sender_id THEN user_hi ELSE user_lo END
    INTO other
    FROM dm_threads WHERE id = NEW.thread_id;

  PERFORM public.push_message_notification(other, NEW.sender_id, parts[1], parts[2]);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_dm ON public.dm_messages;
CREATE TRIGGER trg_notify_new_dm
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_dm();

-- Clearing the alert when you actually open the conversation: marking a thread
-- read marks its message notifications read too, so the badge matches the inbox.
CREATE OR REPLACE FUNCTION public.mark_message_notifications_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
     SET read = true
   WHERE user_id = NEW.user_id
     AND type = 'message'
     AND read = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_message_notifications_read ON public.chat_read_state;
CREATE TRIGGER trg_mark_message_notifications_read
  AFTER INSERT OR UPDATE ON public.chat_read_state
  FOR EACH ROW EXECUTE FUNCTION public.mark_message_notifications_read();
