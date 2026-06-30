import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadAiConfig, callAi } from "@/lib/vkm/ai-provider";
import {
  BUSINESS_FIELDS,
  BUSINESS_FIELD_KEYS,
  type BusinessFieldKey,
  type ExtractedBusiness,
} from "@/lib/vkm/business-fields";

// Bound the document text we send to the provider so a huge PDF can't drive up
// cost. ~12k chars (~3-4k tokens) comfortably covers a business plan / profile.
const MAX_DOC_CHARS = 12_000;
const NUMERIC: Record<BusinessFieldKey, boolean> = Object.fromEntries(
  BUSINESS_FIELDS.map((f) => [f.key, f.kind === "int" || f.kind === "inr" || f.kind === "pct"]),
) as Record<BusinessFieldKey, boolean>;

const fieldGuide = BUSINESS_FIELDS.map((f) => `- ${f.key} (${f.kind}): ${f.hint}`).join("\n");

const EXTRACT_SYSTEM = `You extract structured business-profile data from a document a small-business owner uploaded (business plan, profile, pitch deck export, financial summary, etc.).

Return ONLY a JSON object, no prose, no markdown fences, shaped exactly:
{ "fields": { <key>: <string value>, ... }, "notes": "<one short sentence on what you could not find, or empty>" }

Rules:
- Only include a key if the document clearly states or strongly implies its value. OMIT anything you are unsure about — do NOT guess.
- Allowed keys (use these exact names):
${fieldGuide}
- All values must be STRINGS.
- For (int) fields: digits only, no commas or words.
- For (inr) fields: the amount in WHOLE RUPEES as digits only — expand "lakh"/"L" (×100000) and "crore"/"Cr" (×10000000); strip ₹, commas and currency words.
- For (pct) fields: a number 0-100, digits only (no % sign).
- For (long)/(text) fields: keep it concise (one or two sentences max).
- Never invent numbers or facts not supported by the document.`;

// Pull the first balanced JSON object out of a model reply (handles code fences
// or stray prose around it).
function parseJsonObject(raw: string): unknown {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalise(key: BusinessFieldKey, value: unknown): string | null {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a" || s === "-") return null;

  if (NUMERIC[key]) {
    // Keep digits only; defends against the model slipping in ₹, commas or units.
    const digits = s.replace(/[^\d.]/g, "");
    if (!digits) return null;
    const n = Math.round(Number(digits));
    if (!Number.isFinite(n) || n < 0) return null;
    s = String(n);
  }

  // Length guards: long-form gets more room than numeric fields.
  return s.slice(0, NUMERIC[key] ? 15 : 600);
}

/**
 * Extract business-profile fields from already-parsed document text.
 *
 * The PDF is parsed to text on the CLIENT (pdf-text.ts) and only the text is
 * sent here — the raw file never touches the server or storage. The AI provider
 * key stays server-side via loadAiConfig().
 */
export const extractBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { text?: string }) => {
    const text = typeof input?.text === "string" ? input.text : "";
    if (text.trim().length < 20) {
      throw new Error("Not enough readable text in the document to extract from.");
    }
    return { text: text.slice(0, MAX_DOC_CHARS) };
  })
  .handler(async ({ data }) => {
    const cfg = await loadAiConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return {
        ok: false as const,
        activated: false,
        fields: {} as ExtractedBusiness,
        notes: "",
        error:
          "AI isn't activated yet. Ask your VKM admin to configure an AI provider in Admin → AI Configurations.",
      };
    }

    // Give extraction enough room for the full field set; deterministic temp.
    const extractCfg = { ...cfg, maxTokens: Math.max(cfg.maxTokens, 1500) };
    const r = await callAi(
      extractCfg,
      EXTRACT_SYSTEM,
      [{ role: "user", content: `DOCUMENT:\n"""\n${data.text}\n"""` }],
      { temperature: 0 },
    );

    if (!r.ok) {
      console.error(`extractBusinessProfile provider error ${r.status}:`, r.error);
      return {
        ok: false as const,
        activated: true,
        fields: {} as ExtractedBusiness,
        notes: "",
        error:
          r.status === 429 || r.status >= 500
            ? "The AI service is busy right now — please try again in a moment."
            : `The AI provider returned an error (${r.status}).`,
      };
    }

    const parsed = parseJsonObject(r.content) as {
      fields?: Record<string, unknown>;
      notes?: unknown;
    } | null;
    const rawFields = (parsed?.fields ?? {}) as Record<string, unknown>;

    const fields: ExtractedBusiness = {};
    for (const key of BUSINESS_FIELD_KEYS) {
      if (!(key in rawFields)) continue;
      const v = normalise(key, rawFields[key]);
      if (v != null) fields[key] = v;
    }

    const notes = typeof parsed?.notes === "string" ? parsed.notes.slice(0, 300) : "";

    if (!Object.keys(fields).length) {
      return {
        ok: false as const,
        activated: true,
        fields,
        notes,
        error:
          "Couldn't find clear business details in that document. Try a file with your business plan, profile or numbers.",
      };
    }

    return { ok: true as const, activated: true, fields, notes, error: "" };
  });
