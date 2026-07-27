// Fetch ALL rows for a PostgREST query, paging past Supabase's 1000-row cap.
//
// Supabase returns at most ~1000 rows per request. A query that loads many
// users' rows at once (e.g. every participant's habit_logs) silently truncates
// at 1000 — so some users end up with partial or empty data. Wrap such reads in
// this helper: `build(from, to)` must return the SAME query with `.range(from,
// to)` applied and a STABLE `.order(...)` so pages don't overlap or skip.

export async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  page = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}
