import type { ChatMsg } from "@/lib/vkm/advisor.functions";

/**
 * Client-side conversation history for the AI Advisor.
 *
 * ChatGPT / Claude / Gemini all keep a list of past conversations you can jump
 * back into. We do the same, but entirely in localStorage: the advisor sends
 * the transcript to the server on every turn, so nothing needs to be stored
 * server-side for the chat to work, and keeping it local means a participant's
 * private business questions never outlive their own browser.
 */
export type Thread = {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
};

/** Keep history bounded so localStorage never fills up on a heavy user. */
const MAX_THREADS = 40;

export const threadsKey = (userId: string) => `vkm.advisor.threads.${userId}`;
export const activeKey = (userId: string) => `vkm.advisor.active.${userId}`;
/** Pre-history single-thread key — migrated on first load, then removed. */
const legacyKey = (userId: string) => `vkm.advisor.thread.${userId}`;

export function newThread(): Thread {
  const now = Date.now();
  return {
    id: `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** First user line, trimmed to something that fits a sidebar row. */
export function titleFor(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "user")?.content?.trim();
  if (!first) return "New chat";
  const oneLine = first.replace(/\s+/g, " ");
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}

export function loadThreads(userId: string): Thread[] {
  if (typeof localStorage === "undefined") return [];
  let threads: Thread[] = [];
  try {
    const raw = localStorage.getItem(threadsKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      threads = parsed.filter(
        (t): t is Thread =>
          !!t &&
          typeof t === "object" &&
          Array.isArray((t as Thread).messages) &&
          !!(t as Thread).id,
      );
    }
  } catch {
    threads = [];
  }

  // One-time migration of the old single-thread transcript.
  try {
    const legacy = localStorage.getItem(legacyKey(userId));
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMsg[];
      if (Array.isArray(msgs) && msgs.length) {
        const t = newThread();
        t.messages = msgs;
        t.title = titleFor(msgs);
        threads = [t, ...threads];
      }
      localStorage.removeItem(legacyKey(userId));
    }
  } catch {
    /* ignore — a bad legacy blob just means no migration */
  }

  return threads.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveThreads(userId: string, threads: Thread[]) {
  if (typeof localStorage === "undefined") return;
  try {
    // Never persist an empty scratch thread — it would pile up "New chat" rows.
    const keep = threads.filter((t) => t.messages.length > 0).slice(0, MAX_THREADS);
    localStorage.setItem(threadsKey(userId), JSON.stringify(keep));
  } catch {
    /* quota or private mode — history is a convenience, not a requirement */
  }
}

export function loadActiveId(userId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(activeKey(userId));
  } catch {
    return null;
  }
}

export function saveActiveId(userId: string, id: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(activeKey(userId), id);
  } catch {
    /* ignore */
  }
}

/** "Today" / "Yesterday" / "Previous 7 days" / "Older" — the ChatGPT grouping. */
export function groupThreads(threads: Thread[]): { label: string; items: Thread[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const weekAgo = startOfToday - 7 * 86_400_000;

  const buckets: { label: string; items: Thread[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const t of threads) {
    if (t.updatedAt >= startOfToday) buckets[0].items.push(t);
    else if (t.updatedAt >= startOfYesterday) buckets[1].items.push(t);
    else if (t.updatedAt >= weekAgo) buckets[2].items.push(t);
    else buckets[3].items.push(t);
  }
  return buckets.filter((b) => b.items.length > 0);
}
