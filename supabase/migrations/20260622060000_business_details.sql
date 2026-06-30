-- Richer business profile for owners — the details a coach/AI needs to mentor
-- (and that the curriculum references: USP, ideal customer, competitors, model).
ALTER TABLE public.business_brains
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS legal_structure text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS founded_year int,
  ADD COLUMN IF NOT EXISTS num_customers int,
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS usp text,
  ADD COLUMN IF NOT EXISTS target_customer text,
  ADD COLUMN IF NOT EXISTS main_competitors text,
  ADD COLUMN IF NOT EXISTS social_handle text;
