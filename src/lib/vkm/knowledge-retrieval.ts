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

// The `embed` edge function runs gte-small once per input, sequentially, inside
// a single worker. Past roughly 5 paragraph-sized inputs it exhausts the
// worker's compute budget and returns HTTP 546 WORKER_RESOURCE_LIMIT — which
// surfaces to the admin as the useless "Edge Function returned a non-2xx status
// code". Measured: 5 inputs OK, 10 inputs fails. Keep well under the ceiling.
const EMBED_BATCH = 5;

// Embed one batch, halving and retrying if the worker ran out of compute, so one
// unusually heavy input can't fail the whole ingest. Bottoms out at a single
// input, where a failure is real and worth throwing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function embedBatch(client: SupabaseClient<any>, texts: string[]): Promise<number[][]> {
  const { data, error } = await client.functions.invoke("embed", { body: { input: texts } });
  const embs = (data as { embeddings?: number[][] } | null)?.embeddings;
  if (!error && embs?.length === texts.length) return embs;

  if (texts.length > 1) {
    const mid = Math.ceil(texts.length / 2);
    return [
      ...(await embedBatch(client, texts.slice(0, mid))),
      ...(await embedBatch(client, texts.slice(mid))),
    ];
  }
  throw new Error(error?.message || "Embedding service failed");
}

// Embed one or more texts via the `embed` edge function (Supabase gte-small).
// Callers may pass any number of texts — batching is handled here so no caller
// has to know the worker's limit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedTexts(client: SupabaseClient<any>, texts: string[]): Promise<number[][]> {
  if (!texts.length) throw new Error("Nothing to embed");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    out.push(...(await embedBatch(client, texts.slice(i, i + EMBED_BATCH))));
  }
  if (!out.length) throw new Error("Embedding service returned nothing");
  return out;
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
