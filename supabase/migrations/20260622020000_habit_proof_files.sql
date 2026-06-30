-- Daily-habit proof attachments. When a participant marks a habit done they must
-- attach evidence (image / video / pdf / doc). Stored as jsonb [{kind,url,name,size}].
ALTER TABLE public.habit_logs
  ADD COLUMN IF NOT EXISTS proof_files jsonb NOT NULL DEFAULT '[]'::jsonb;
