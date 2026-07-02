-- Business logo — a single field on the owner's business_brains, editable from
-- both the Business profile settings and the My Business page (same source, so
-- a change in either place reflects in the other). Existing RLS on
-- business_brains (owner insert/update/select) already covers it.
alter table public.business_brains
  add column if not exists logo_url text;
