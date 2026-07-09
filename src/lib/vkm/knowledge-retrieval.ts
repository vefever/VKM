import type { SupabaseClient } from "@supabase/supabase-js";

// Shared server-side helpers for the VK Knowledge base (RAG). Used by the
// ingestion server fns and by the AI advisor's retrieval step.

export type VkChunk = {
  id: string;
  content: string;
  source_title: string | null;
  program: string | null;
  topic: string | null;
  language: string | null;
  similarity: number;
};

// Embed one or more texts via the `embed` edge function (Supabase gte-small).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedTexts(client: SupabaseClient<any>, texts: string[]): Promise<number[][]> {
  const { data, error } = await client.functions.invoke("embed", { body: { input: texts } });
  if (error) throw new Error(error.message || "Embedding service failed");
  const embs = (data as { embeddings?: number[][] } | null)?.embeddings;
  if (!embs || !embs.length) throw new Error("Embedding service returned nothing");
  return embs;
}

// Retrieve the top-k most relevant VK knowledge chunks for a query. Never throws
// — retrieval failure just yields no chunks so the advisor still answers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retrieveVkKnowledge(client: SupabaseClient<any>, query: string, k = 5): Promise<VkChunk[]> {
  try {
    const q = (query || "").trim();
    if (!q) return [];
    const [emb] = await embedTexts(client, [q]);
    if (!emb) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)("match_vk_knowledge", {
      query_embedding: JSON.stringify(emb), // pgvector accepts the text literal
      match_count: k,
    });
    if (error) return [];
    return (data ?? []) as VkChunk[];
  } catch {
    return [];
  }
}

// Break long text into ~1200-char chunks on paragraph/sentence boundaries so a
// framework or Q&A answer isn't split mid-thought (blueprint §05, simplified).
export function chunkText(text: string, target = 1200): string[] {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (p.length > target * 1.6) {
      // very long paragraph — split on sentence ends
      if (cur) { chunks.push(cur); cur = ""; }
      const sentences = p.split(/(?<=[.!?।])\s+/);
      for (const s of sentences) {
        if ((cur + " " + s).length > target && cur) { chunks.push(cur.trim()); cur = ""; }
        cur += (cur ? " " : "") + s;
      }
      continue;
    }
    if ((cur + "\n\n" + p).length > target && cur) { chunks.push(cur.trim()); cur = ""; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 20);
}
