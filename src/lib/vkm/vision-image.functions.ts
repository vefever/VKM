import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateImage, loadImageConfig, type ImageRef } from "@/lib/vkm/image-provider";
import { IMAGE_PURPOSES, type ImagePurpose } from "@/lib/vkm/image-purposes";

// How many AI images one participant may generate per calendar month. Image
// models are the most expensive call in the platform and this is the first
// participant-triggered one, so the cap is deliberate: without it a single owner
// holding the button could run up a real bill on the shared org key.
const MONTHLY_LIMIT = 5;

// India Standard Time. The cap is described to owners as "this month", and every
// participant is in AP/Telangana, so the month must turn over at midnight IST —
// counting in UTC would reset their allowance at 5:30am local.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of the current IST calendar month, as a UTC instant. */
function monthStartIst(): Date {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/**
 * "1 October" — when their next batch unlocks. Derived from the IST-shifted
 * clock, NOT from monthStartIst(): that returns a UTC instant which, for a month
 * starting 1 Sep IST, lands on 31 Aug UTC — so reading its month gives August
 * and the label comes out one month early.
 */
function nextResetLabel(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const next = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1));
  return `1 ${next.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}`;
}

// Baseline rules when the owner supplies no reference images: don't invent a
// recognisable person, and don't render text, which image models turn into
// convincing gibberish that would read as a real (wrong) sign above a business.
const GLOBAL_RULES =
  "Do not depict real, identifiable people. " +
  "Do not render any text, letters, words, logos or watermarks anywhere in the image.";

// When the owner opts to use their own face and/or logo, the "no identifiable
// people / no logos" rules are exactly what we DON'T want — but only ever for
// their own likeness and their own brand, both read from their own records.
const REF_RULES =
  "Reference images are provided above. Use them faithfully. " +
  "Any person shown must closely match the face, build, skin tone and typical " +
  "clothing style of the person in the reference photo — this is the business " +
  "owner picturing themselves, so the likeness matters. " +
  "Where a logo reference is provided, reproduce that logo accurately on signage, " +
  "packaging, uniforms or vehicles where it would naturally appear. " +
  "Apart from the logo itself, do not invent any other text or lettering.";

/**
 * The poster is the one purpose where text is wanted — a vision poster with no
 * title isn't a poster. Image models still letter badly, so this is tightly
 * bounded: ONE short line, quoted verbatim so there is nothing to invent, and an
 * explicit ban on the surrounding gibberish they otherwise fill posters with.
 */
function posterRules(headline: string | null | undefined): string {
  const title = (headline ?? "").trim().slice(0, 60);
  if (!title) {
    return (
      "Render NO text, letters or words anywhere — leave the title area clean and empty. " +
      "Do not depict real, identifiable people."
    );
  }
  return (
    `Render exactly this text as the poster title, spelled EXACTLY as written, once: "${title}". ` +
    "Set it in a clean bold sans-serif, well-composed in the upper negative space, high contrast " +
    "and fully legible. Render NO other text anywhere — no subtitles, no captions, no logos, " +
    "no watermarks, no invented words or letterforms, and specifically none on signage, " +
    "shopfronts, buildings, screens, tablets, posters or plaques within the scene. " +
    "Do not depict real, identifiable people."
  );
}

// Cap on a reference image we'll inline into the request. Stored uploads are
// already compressed on the way in, so anything past this is anomalous and not
// worth pushing through the model.
const MAX_REF_BYTES = 4 * 1024 * 1024;

/**
 * Download one of the owner's own stored images (profile photo, business logo)
 * and inline it as a model reference. Never throws: a missing or oversized
 * reference just means the image is generated without it.
 */
async function loadRef(url: string | null | undefined): Promise<ImageRef | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_REF_BYTES) return null;
    return { b64: buf.toString("base64"), mime: r.headers.get("content-type") || "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * The owner's own business, turned into art direction.
 *
 * This is the point of generating here rather than in a generic image tool: an
 * image for "Sri Lakshmi Silks, a saree retailer in Guntur serving families"
 * beats one for "a shop". Only fields the owner has actually filled in are used
 * — an empty Business Brain simply yields a shorter, still-usable prompt.
 */
function businessDirection(
  b: {
    business_name?: string | null;
    industry?: string | null;
    location?: string | null;
    target_customer?: string | null;
    top_products?: string | null;
  } | null,
): string {
  if (!b) return "";
  const bits: string[] = [];
  if (b.industry) bits.push(`Industry/category: ${b.industry}`);
  if (b.top_products) bits.push(`What they sell: ${b.top_products}`);
  if (b.target_customer) bits.push(`Their customers: ${b.target_customer}`);
  if (b.location) bits.push(`Location: ${b.location} (India)`);
  if (!bits.length) return "";
  return (
    `This is for an Indian small-business owner. Match the look and feel of their business:\n` +
    bits.join("\n") +
    // The name is context for tone, NOT something to draw — image models will
    // happily letter a signboard with it, badly.
    (b.business_name
      ? `\nThe business is called "${b.business_name}" — reflect its character, but do NOT write the name in the image.`
      : "")
  );
}

/** Compact INR for prompt text — "Rs 2.5 Cr" reads better than 25000000. */
function inr(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_00_00_000) return `Rs ${+(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `Rs ${+(n / 1_00_000).toFixed(2)} Lakh`;
  return `Rs ${n.toLocaleString("en-IN")}`;
}

/**
 * The owner's actual vision, turned into art direction.
 *
 * This is the whole point of generating from inside the Vision Board rather than
 * a generic image tool: the page already holds what they're working toward — the
 * 5-year statement, this year's north star, the lifestyle they want, the team
 * size and revenue they're aiming at, and their concrete goals. An image that
 * ignores all of that is just stock photography.
 *
 * Only the goals matching the requested purpose are included, so a "shop/office"
 * image isn't diluted by personal-lifestyle goals and vice versa.
 */
function visionDirection(
  s: {
    statement?: string | null;
    statement_1yr?: string | null;
    primary_goal?: string | null;
    target_revenue_inr?: number | null;
    target_team_size?: number | null;
    lifestyle_goal?: string | null;
  } | null,
  goals: { title: string; category: string; target_value: number | null; unit: string | null }[],
  purpose: ImagePurpose,
): string {
  const bits: string[] = [];
  if (s?.statement) bits.push(`Their 5-year vision: ${s.statement}`);
  if (s?.statement_1yr) bits.push(`This year they are working toward: ${s.statement_1yr}`);
  if (s?.primary_goal) bits.push(`Their headline goal: ${s.primary_goal}`);

  const revenue = inr(s?.target_revenue_inr);
  if (revenue) bits.push(`Revenue they are aiming at: ${revenue} — the scale should look the part`);
  if (s?.target_team_size)
    bits.push(
      `Team they want: about ${s.target_team_size} people — show a team of roughly that size`,
    );
  // Lifestyle only belongs in the aspirational board, not a shopfront or a post.
  if (s?.lifestyle_goal && (purpose === "vision" || purpose === "poster"))
    bits.push(`The life they want: ${s.lifestyle_goal}`);

  // Pillars worth depicting differ by what the image is for.
  const wanted: Record<ImagePurpose, string[]> = {
    // The poster represents the whole vision, so nothing is filtered out.
    poster: [
      "Revenue & Profit",
      "Team & Culture",
      "Product & Operations",
      "Brand & Market",
      "Personal & Lifestyle",
    ],
    vision: ["Revenue & Profit", "Personal & Lifestyle", "Team & Culture", "Brand & Market"],
    workspace: ["Product & Operations", "Team & Culture", "Revenue & Profit"],
    social: ["Brand & Market", "Product & Operations"],
    story: ["Brand & Market", "Personal & Lifestyle"],
  };
  const relevant = goals
    .filter((g) => wanted[purpose].includes(g.category))
    .slice(0, 4)
    .map((g) => {
      const target = g.target_value ? ` (${g.target_value}${g.unit ? ` ${g.unit}` : ""})` : "";
      return `- ${g.title}${target}`;
    });
  if (relevant.length) bits.push(`Goals this picture should feel like:\n${relevant.join("\n")}`);

  if (!bits.length) return "";
  return `This image is for their Vision Board. Make it depict THEIR specific future, not a generic one:\n${bits.join("\n")}`;
}

/**
 * Generate one image for the signed-in participant, grounded in their own
 * Business Brain. Returns the image inline as a data URL; the client uploads it
 * through the same path as a manual upload, so a generated image and an
 * uploaded one are indistinguishable downstream.
 */
export const generateVisionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      prompt?: string;
      purpose?: string;
      size?: string;
      useFace?: boolean;
      useLogo?: boolean;
    }) => ({
      prompt: String(input?.prompt ?? "")
        .slice(0, 500)
        .trim(),
      purpose: (input?.purpose && input.purpose in IMAGE_PURPOSES
        ? input.purpose
        : "vision") as ImagePurpose,
      // Opt-in per request: putting your own face in an image is a choice the
      // owner makes each time, not a setting that quietly stays on.
      useFace: !!input?.useFace,
      useLogo: !!input?.useLogo,
      // An explicit size overrides the purpose default, but only from the three
      // the models actually accept.
      size:
        input?.size === "1024x1024" || input?.size === "1536x1024" || input?.size === "1024x1536"
          ? input.size
          : "",
    }),
  )
  .handler(async ({ data, context }) => {
    const fail = (error: string, remaining = 0) =>
      ({ ok: false as const, dataUrl: "", error, remaining }) as const;

    if (!data.prompt) return fail("Describe the image you want.");

    const cfg = await loadImageConfig();
    if (!cfg.enabled || !cfg.apiKey) {
      return fail(
        "AI image generation isn't switched on yet. Ask your VKM admin to set an image provider in Admin -> AI Configurations.",
      );
    }

    // Rate limit off the participant's own recent generations (RLS-scoped), and
    // load the business context in the same round trip.
    const since = monthStartIst().toISOString();
    const [{ count }, { data: brain }, { data: prof }, { data: vision }, { data: goals }] =
      await Promise.all([
        context.supabase
          .from("ai_image_generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .gte("created_at", since),
        context.supabase
          .from("business_brains")
          .select("business_name, industry, location, target_customer, top_products, logo_url")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", context.userId)
          .maybeSingle(),
        context.supabase
          .from("vision_statements")
          .select(
            "statement, statement_1yr, primary_goal, target_revenue_inr, target_team_size, lifestyle_goal",
          )
          .eq("user_id", context.userId)
          .maybeSingle(),
        // Nearest-term goals first: what they're chasing now is more evocative
        // than a year-5 target, and the prompt only has room for a handful.
        context.supabase
          .from("vision_goals")
          .select("title, category, target_value, unit")
          .eq("user_id", context.userId)
          .order("year", { ascending: true })
          .order("sort_order", { ascending: true })
          .limit(20),
      ]);

    const used = count ?? 0;
    if (used >= MONTHLY_LIMIT) {
      return fail(
        `You've used all ${MONTHLY_LIMIT} AI images for this month. Your next ${MONTHLY_LIMIT} unlock on ${nextResetLabel()} — until then, upload your own images.`,
      );
    }
    const remaining = MONTHLY_LIMIT - used - 1;

    // The owner's own likeness and own brand, only when they asked for them.
    // OpenAI's /images/generations has no reference slot, so this is Gemini-only
    // — say so plainly rather than silently returning a stranger's face.
    const wantsRefs = data.useFace || data.useLogo;
    if (wantsRefs && cfg.provider !== "gemini") {
      return fail(
        "Using your photo or logo needs the Gemini image provider. Ask your admin to switch it in Admin -> AI Configurations, or turn those options off.",
        remaining + 1,
      );
    }

    const [faceRef, logoRef] = await Promise.all([
      data.useFace ? loadRef(prof?.avatar_url) : Promise.resolve(null),
      data.useLogo ? loadRef(brain?.logo_url) : Promise.resolve(null),
    ]);
    const refs = [faceRef, logoRef].filter((x): x is ImageRef => !!x);

    if (data.useFace && !faceRef) {
      return fail(
        "Couldn't read your profile photo. Add one in your profile settings, then try again.",
        remaining + 1,
      );
    }
    if (data.useLogo && !logoRef) {
      return fail(
        "Couldn't read your business logo. Add one on the My Business page, then try again.",
        remaining + 1,
      );
    }

    const purpose = IMAGE_PURPOSES[data.purpose];
    const fullPrompt = [
      data.prompt,
      businessDirection(brain),
      visionDirection(vision, goals ?? [], data.purpose),
      purpose.style,
      refs.length
        ? REF_RULES
        : data.purpose === "poster"
          ? posterRules(vision?.primary_goal)
          : GLOBAL_RULES,
    ]
      .filter(Boolean)
      .join("\n\n");

    // The poster is the one output with a rendered title, and title fidelity is
    // model-dependent. Measured on the same prompt: gemini-3.1-flash-lite-image
    // spelled the title correctly but added an invented "FRANCHISE OPPORTUNITIES"
    // plaque; gemini-3.1-flash-image lettered the buildings; gemini-3-pro-image
    // rendered the title cleanly and added no stray text at all. Posters are
    // capped and infrequent, so the slower, dearer model is worth it here — every
    // other purpose still uses whatever the admin configured.
    const model =
      data.purpose === "poster" && cfg.provider === "gemini" ? "gemini-3-pro-image" : undefined;

    // Posters get printed and pasted on a physical vision board, so they need
    // print resolution, not screen resolution.
    const isPoster = data.purpose === "poster";

    const r = await generateImage(cfg, fullPrompt, {
      model,
      size: data.size || purpose.size,
      refs: refs.length ? refs : undefined,
      hiRes: isPoster,
    });
    if (!r.ok) return fail(r.error, remaining + 1);

    // Log the spend before returning, so a client that drops the response still
    // counts against the cap.
    await context.supabase
      .from("ai_image_generations")
      // Log the model actually used, not the configured default — posters
      // override it, and a log that says otherwise is worse than no log.
      .insert({ user_id: context.userId, prompt: data.prompt, model: model ?? cfg.model });

    // Normalise to a data URL so the client has exactly one thing to upload.
    // dall-e-3 hands back a short-lived URL on the provider's own domain, which
    // the browser can't re-fetch to upload (no CORS headers) and which expires —
    // so fetch it here, server-side, and inline it like every other model.
    let b64 = r.b64;
    let mime = r.mime;
    if (!b64 && r.url) {
      try {
        const img = await fetch(r.url);
        if (!img.ok) throw new Error(`fetch returned ${img.status}`);
        b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
        mime = img.headers.get("content-type") || "image/png";
      } catch (e) {
        return fail(`Couldn't download the generated image: ${(e as Error).message}`, remaining);
      }
    }
    return {
      ok: true as const,
      dataUrl: `data:${mime};base64,${b64}`,
      error: "",
      remaining,
    };
  });
