// URL sanitization for user-supplied links (proof submissions, notification
// targets, chat content). Untrusted hrefs can carry `javascript:`, `data:`, or
// `vbscript:` schemes that execute script when clicked — a stored-XSS vector.
// Only http(s) and mailto are allowed through; anything else is neutralized.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

// Control chars (0x00-0x1F, 0x7F) can obfuscate schemes like `java\tscript:`.
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

/**
 * Returns a safe href for rendering an untrusted link, or `undefined` if the
 * value can't be trusted. Render with `rel="noopener noreferrer nofollow"` and
 * `target="_blank"`; when this returns `undefined`, render plain text instead of
 * an anchor.
 */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;

  if (hasControlChars(value)) return undefined;

  // Allow site-relative paths and fragments outright (no scheme to abuse).
  if (value.startsWith("/") || value.startsWith("#")) return value;

  try {
    // Resolve against a dummy base so scheme-relative + relative URLs parse.
    const url = new URL(value, "https://base.invalid");
    // If parsing pulled in an explicit scheme, it must be allow-listed.
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

/** True when an untrusted link is safe to render as a clickable anchor. */
export function isSafeHref(raw: string | null | undefined): boolean {
  return safeHref(raw) !== undefined;
}
