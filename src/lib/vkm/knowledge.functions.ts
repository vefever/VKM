import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedTexts, chunkText } from "@/lib/vkm/knowledge-retrieval";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden: super admins only");
}

// Ingest a piece of Venu's teaching: chunk → embed → store. Each chunk becomes a
// retrievable row. Super-admin only.
export const ingestKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    title: string;
    text: string;
    program?: string;
    module?: string;
    topic?: string;
    language?: string;
    source_type?: string;
    priority?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const title = (data.title || "").trim();
    const text = (data.text || "").trim();
    if (!title) throw new Error("A source title is required.");
    if (text.length < 30) throw new Error("Paste at least a paragraph of content.");

    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("Nothing to ingest after chunking.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Embed in batches so a big paste doesn't overload one call.
    const rows: Record<string, unknown>[] = [];
    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embs = await embedTexts(supabaseAdmin, slice);
      slice.forEach((content, j) => {
        rows.push({
          content,
          embedding: JSON.stringify(embs[j]), // pgvector text literal "[.., ..]"
          source_title: title,
          program: data.program?.trim() || null,
          module: data.module?.trim() || null,
          topic: data.topic?.trim() || null,
          language: data.language || "english",
          source_type: data.source_type || "text",
          priority: data.priority || "normal",
          chunk_index: i + j,
          created_by: context.userId,
        });
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.from("vk_knowledge").insert(rows as any);
    if (error) throw new Error(error.message);
    return { ok: true, chunks: rows.length };
  });

// List ingested sources, grouped by title (for the admin manager).
export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vk_knowledge")
      .select("source_title, program, topic, language, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const groups = new Map<string, { title: string; program: string | null; topic: string | null; language: string | null; chunks: number; created_at: string }>();
    for (const r of (data ?? []) as { source_title: string; program: string | null; topic: string | null; language: string | null; created_at: string }[]) {
      const key = r.source_title || "(untitled)";
      const g = groups.get(key);
      if (g) g.chunks++;
      else groups.set(key, { title: key, program: r.program, topic: r.topic, language: r.language, chunks: 1, created_at: r.created_at });
    }
    return [...groups.values()];
  });

// Delete every chunk of a source by its title.
export const deleteKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { title: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vk_knowledge").delete().eq("source_title", data.title);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Quick retrieval test for the admin: shows which chunks a question would pull.
export const testKnowledgeSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { retrieveVkKnowledge } = await import("@/lib/vkm/knowledge-retrieval");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chunks = await retrieveVkKnowledge(supabaseAdmin, data.query, 5);
    return chunks.map((c) => ({
      source_title: c.source_title,
      topic: c.topic,
      similarity: Math.round((c.similarity ?? 0) * 100),
      preview: c.content.slice(0, 220),
    }));
  });
