-- 1-Year Vision: a near-term north-star line, separate from the 5-year statement.
-- The 5-year vision is the destination; this is the route the owner walks now.
alter table public.vision_statements
  add column if not exists statement_1yr text;
