// Participant access tiers. A participant's tier is derived from their batch
// status + alumni flag; it controls which pages show in the nav and which
// routes they can open. (Data is still protected by RLS — this is UX gating.)

export type AccessTier = "full" | "alumni" | "community";

// Batch statuses that count as "past" (previous cohort).
export const PAST_BATCH_STATUSES = new Set(["completed", "archived", "past", "graduated"]);

// Allowed route prefixes per tier. `null` = everything (full participant).
// Account pages (profile/settings, notifications) + community are always in.
const ALLOWED: Record<AccessTier, string[] | null> = {
  full: null,
  alumni: [
    "/participant/community",
    "/participant/business",
    "/participant/advisor", // the advisor lives with the business cockpit
    "/participant/support",
    "/participant/profile",
    "/participant/notifications",
  ],
  community: ["/participant/community", "/participant/profile", "/participant/notifications"],
};

// The page a restricted user lands on / is redirected to.
export const TIER_HOME: Record<AccessTier, string> = {
  full: "/participant",
  alumni: "/participant/community",
  community: "/participant/community",
};

export function isPathAllowed(tier: AccessTier, pathname: string): boolean {
  const allow = ALLOWED[tier];
  if (allow === null) return true;
  return allow.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Keep only the nav items a tier may see (used to filter PARTICIPANT_NAV). */
export function allowsNavPath(tier: AccessTier, to: string): boolean {
  return isPathAllowed(tier, to);
}
