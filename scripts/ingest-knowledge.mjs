// Chunk + embed the workbook seed files under src/content/knowledge/ into the
// vk_knowledge table, so the Venu Kalyan Avatar retrieves Venu's real teaching
// (RAG) instead of answering from the persona prompt alone.
//
//   node scripts/ingest-knowledge.mjs             # ingest every seed
//   node scripts/ingest-knowledge.mjs ms-workbook # ingest one by slug
//   node scripts/ingest-knowledge.mjs --dry-run   # chunk only, no writes
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see .env.example). Re-running
// is safe: each source's existing chunks are deleted before its new ones land,
// so a re-extract updates in place instead of duplicating.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// One entry per seed file. `title` is what the advisor cites back to the owner,
// so keep it human-readable — it shows up in the admin Knowledge Base list too.
const SOURCES = [
  {
    slug: "ms-workbook",
    file: "src/content/knowledge/ms-workbook.txt",
    title: "MSGB Workbook - Marketing & Sales Growth Bootcamp",
    program: "MSGB",
    topic: "marketing, sales, branding, USP, leads, follow-up",
  },
  {
    slug: "ubm-workbook-b17",
    file: "src/content/knowledge/ubm-workbook-b17.txt",
    title: "UBM Workbook - Ultimate Business Mastery (Batch 17)",
    program: "UBM",
    topic: "goals, business model, team, hiring, systems, culture",
  },
];

// Mirrors chunkText() in src/lib/vkm/knowledge-retrieval.ts — same ~1200-char
// paragraph/sentence-boundary split, so script-ingested chunks and admin-pasted
// chunks retrieve identically.
function chunkText(text, target = 1200) {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if (p.length > target * 1.6) {
      if (cur) { chunks.push(cur); cur = ""; }
      for (const s of p.split(/(?<=[.!?।])\s+/)) {
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

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));
const targets = only.length ? SOURCES.filter((s) => only.includes(s.slug)) : SOURCES;

if (!targets.length) {
  console.error(`No source matched. Known slugs: ${SOURCES.map((s) => s.slug).join(", ")}`);
  process.exit(1);
}

let supabase = null;
if (!dryRun) {
  // Pick up a local .env the same way the app does, so the key never has to be
  // typed on the command line (where it would land in shell history).
  try {
    process.loadEnvFile(join(root, ".env"));
  } catch {
    /* no .env — fall through to the real environment */
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing credentials. Create .env from .env.example with:\n" +
        '  SUPABASE_URL="https://<project-ref>.supabase.co"\n' +
        '  SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."\n' +
        "\nThe service-role key is required: the vk_knowledge migration grants insert\n" +
        "to service_role only. Get it from Supabase → Project Settings → API Keys.",
    );
    process.exit(1);
  }
  supabase = createClient(url, key, { auth: { persistSession: false } });
}

// Embed one batch, retrying transient edge-function failures. A worker that ran
// out of compute is retried one input at a time rather than given up on, so a
// single heavy chunk can't abort a 200-chunk ingest halfway through.
async function embed(texts, label) {
  const { data, error } = await supabase.functions.invoke("embed", { body: { input: texts } });
  if (!error && data?.embeddings?.length === texts.length) return data.embeddings;

  if (texts.length > 1) {
    const mid = Math.ceil(texts.length / 2);
    return [
      ...(await embed(texts.slice(0, mid), label)),
      ...(await embed(texts.slice(mid), label)),
    ];
  }
  throw new Error(`embed ${label}: ${error?.message ?? "no embeddings returned"}`);
}

for (const src of targets) {
  const text = await readFile(join(root, src.file), "utf8");
  const chunks = chunkText(text);
  console.log(`${src.slug}: ${text.length} chars -> ${chunks.length} chunks`);
  if (dryRun) continue;

  // Replace, don't append: a re-extract should update the source in place.
  const { error: delErr } = await supabase
    .from("vk_knowledge")
    .delete()
    .eq("source_title", src.title);
  if (delErr) throw new Error(`delete ${src.slug}: ${delErr.message}`);

  // The `embed` edge function runs gte-small sequentially per input, and dies
  // with WORKER_RESOURCE_LIMIT (HTTP 546) somewhere between 5 and 10 workbook-
  // sized chunks per call. Five is comfortably under that ceiling.
  const BATCH = 5;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const embeddings = await embed(slice, `${src.slug} @${i}`);

    const rows = slice.map((content, j) => ({
      content,
      embedding: JSON.stringify(embeddings[j]), // pgvector accepts the text literal
      source_title: src.title,
      program: src.program,
      topic: src.topic,
      language: "english",
      source_type: "workbook",
      priority: "high",
      chunk_index: i + j,
    }));
    const { error: insErr } = await supabase.from("vk_knowledge").insert(rows);
    if (insErr) throw new Error(`insert ${src.slug} @${i}: ${insErr.message}`);
    process.stdout.write(`  ...${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`);
  }
  console.log(`  ingested ${chunks.length} chunks as "${src.title}"`);
}
