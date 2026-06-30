-- Primary goal: a short headline goal the participant names on the Vision page.
-- It reflects on the Vision page and greets them as a banner on their dashboard.
alter table public.vision_statements
  add column if not exists primary_goal text;
