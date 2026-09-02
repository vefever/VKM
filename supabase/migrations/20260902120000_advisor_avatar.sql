-- Venu Kalyan Avatar portrait, managed from Admin -> VK Knowledge Base.
--
-- Lives on the program_settings singleton because every participant's advisor
-- chat has to read it, and that table is already granted SELECT to authenticated
-- with an admin-only update policy — exactly the access shape this needs. The
-- image itself goes to the public chat-attachments bucket; only the pointer is
-- stored here, and each upload writes a new key so a replaced portrait is never
-- served stale from the CDN.
ALTER TABLE public.program_settings
  ADD COLUMN IF NOT EXISTS advisor_avatar_url text;
