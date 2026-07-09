-- =========================================================
-- VK KNOWLEDGE BASE — RAG Phase 1 (2026-07-08)
--
-- The "Digital Venu Kalyan" brain, phase 1: a pgvector store of Venu's teaching
-- chunks + a cosine-similarity match function. Embeddings are 384-dim from
-- Supabase's built-in gte-small model (see the `embed` edge function). Admins
-- ingest content; the AI advisor retrieves the top matching chunks and answers
-- grounded in them. Full multilingual embeddings + ingestion of A/V transcripts
-- are later phases (blueprint §06, §19).
-- =========================================================

create extension if not exists vector;

create table if not exists public.vk_knowledge (
  id           uuid primary key default gen_random_uuid(),
  content      text not null,
  embedding    vector(384),
  -- provenance + tagging (blueprint §03 metadata schema, trimmed for phase 1)
  source_title text,
  program      text,            -- BOSS | UBM | VKM | Marketing | Sales …
  module       text,
  topic        text,
  language     text default 'english',   -- english | telugu | tinglish
  source_type  text default 'text',      -- text | pdf | video | qna
  priority     text default 'normal',    -- normal | high (cornerstone)
  tags         text[] default '{}',
  chunk_index  int default 0,
  is_active    boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists vk_knowledge_embedding_idx on public.vk_knowledge using hnsw (embedding vector_cosine_ops);
create index if not exists vk_knowledge_active_idx on public.vk_knowledge (is_active);
create index if not exists vk_knowledge_source_idx on public.vk_knowledge (source_title);

alter table public.vk_knowledge enable row level security;
revoke all on public.vk_knowledge from anon;
grant select on public.vk_knowledge to authenticated;   -- staff read via policy; members query via the RPC
grant all on public.vk_knowledge to service_role;

-- Staff can browse the raw knowledge; members never read the table in bulk
-- (blueprint §17) — they only get top-k matches through match_vk_knowledge.
drop policy if exists vk_knowledge_staff_read on public.vk_knowledge;
create policy vk_knowledge_staff_read on public.vk_knowledge
  for select to authenticated
  using (public.is_staff());

-- Cosine-similarity retrieval. SECURITY DEFINER so any authenticated member can
-- fetch the few most relevant chunks for their question (not the whole base).
create or replace function public.match_vk_knowledge(
  query_embedding vector(384),
  match_count int default 5
)
returns table (
  id           uuid,
  content      text,
  source_title text,
  program      text,
  topic        text,
  language     text,
  similarity   float
)
language sql
stable
security definer
set search_path = public
as $$
  select k.id, k.content, k.source_title, k.program, k.topic, k.language,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.vk_knowledge k
  where k.is_active and k.embedding is not null
  order by k.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;
revoke all on function public.match_vk_knowledge(vector, int) from anon, public;
grant execute on function public.match_vk_knowledge(vector, int) to authenticated;
