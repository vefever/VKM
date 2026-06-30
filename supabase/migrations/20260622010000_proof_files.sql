-- Weekly proof attachments (images / video / pdf / docs). Stored as jsonb
-- [{kind,url,name,size}] alongside the optional proof_url link.
ALTER TABLE public.weekly_progress
  ADD COLUMN IF NOT EXISTS proof_files jsonb NOT NULL DEFAULT '[]'::jsonb;
