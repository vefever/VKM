// Client-safe image purpose catalog.
//
// Deliberately NOT in vision-image.functions.ts: the Vision Board imports these
// as values, and that module reaches loadImageConfig -> the service-role Supabase
// client. Keeping the catalog here means the browser bundle never has a reason to
// pull the server module in.
/**
 * What the image is FOR. Purpose drives both the art direction and the shape —
 * a mood-board photo and a shopfront banner want very different framing, and
 * getting that from a dropdown beats asking the owner to describe it.
 *
 * Sizes are the three the OpenAI image models accept (1024x1024, 1536x1024,
 * 1024x1536); Gemini gets the equivalent expressed as an aspect ratio.
 */
export const IMAGE_PURPOSES = {
  poster: {
    label: "Vision poster",
    size: "1024x1536",
    hint: "Portrait · print-ready · your whole vision in one poster",
    style:
      "A single cinematic VISION POSTER — one dramatic, unified composition, NOT a collage, " +
      "grid, mood board, scrapbook or photos pasted on a board. Think a film poster or a " +
      "premium brand campaign key art: one hero subject, strong depth of field, dramatic " +
      "cinematic lighting with warm golden rim light, rich colour grading, deep shadows, " +
      "atmospheric haze, and a clear focal point. Elements of their future should be woven " +
      "into ONE believable scene with natural scale and perspective — never floating cut-outs " +
      "or separate framed panels. Leave calm negative space toward the upper area for a title. " +
      "Epic, aspirational and premium.",
  },
  vision: {
    label: "Vision board",
    size: "1024x1024",
    hint: "Square · the dream you're building",
    style:
      "Aspirational vision-board photography. Cinematic, warm, optimistic, natural light, high quality.",
  },
  workspace: {
    label: "Shop / office",
    size: "1536x1024",
    hint: "Landscape · premises, showroom, workspace",
    style:
      "Wide architectural interior/exterior photography of a business premises. Bright, clean, inviting, professional.",
  },
  social: {
    label: "Social post",
    size: "1024x1024",
    hint: "Square · Instagram / WhatsApp",
    style:
      "Clean, modern social-media background image with generous empty space for text to be added later. Bold, uncluttered composition.",
  },
  story: {
    label: "Story / reel",
    size: "1024x1536",
    hint: "Portrait · status, reels, stories",
    style:
      "Vertical, mobile-first background image with clear empty space in the middle third for text. Modern and eye-catching.",
  },
} as const;

export type ImagePurpose = keyof typeof IMAGE_PURPOSES;
