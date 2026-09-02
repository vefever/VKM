/**
 * Save a URL to the user's device.
 *
 * Fetched to a blob first: the `download` attribute is ignored on cross-origin
 * hrefs, so linking straight at Supabase Storage would navigate to the image
 * instead of saving it. Works for `data:` URLs too, so an unsaved preview can be
 * downloaded before it's added to the board.
 *
 * Falls back to opening in a new tab if the fetch is blocked, which at least
 * leaves the owner able to save it by hand.
 */
export async function downloadUrl(url: string, filename?: string) {
  const ext = (
    url.startsWith("data:") ? url.slice(11, 20).split(";")[0] : (url.split(".").pop() ?? "")
  )
    .split("?")[0]
    .slice(0, 5)
    .replace(/[^a-z0-9]/gi, "");
  const name = filename || `vision-${Date.now()}.${ext || "png"}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on a delay — doing it immediately cancels the save in Safari.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
