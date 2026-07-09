// Embedding edge function — turns text into 384-dim vectors using Supabase's
// built-in gte-small model (runs in-region, free, no external key). Used by the
// VK Knowledge ingestion (admin) and by the AI advisor's retrieval step.
//
// POST { input: string | string[] }  ->  { embeddings: number[][] }
// Requires a valid Supabase JWT (invoked server-to-server by our functions).

// deno-lint-ignore-file no-explicit-any
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// @ts-ignore Supabase Edge Runtime global
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const raw = body?.input;
    const texts: string[] = Array.isArray(raw) ? raw : [raw];
    const clean = texts
      .map((t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : ""))
      .filter((t) => t.length > 0)
      .slice(0, 100); // hard cap per call
    if (clean.length === 0) {
      return new Response(JSON.stringify({ error: "No input text." }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }
    const embeddings: number[][] = [];
    for (const t of clean) {
      const e = await session.run(t.slice(0, 8000), { mean_pool: true, normalize: true });
      embeddings.push(e as number[]);
    }
    return new Response(JSON.stringify({ embeddings }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
