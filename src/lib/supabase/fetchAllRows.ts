import type { PostgrestError } from "@supabase/supabase-js";

/** Supabase (PostgREST) giver højst så mange rækker pr. forespørgsel som standard. */
export const SUPABASE_PAGE_SIZE = 1000;

/**
 * Henter alle rækker fra en forespørgsel, i bidder af 1000. Uden dette
 * stopper Supabase stille ved 1000 rækker, så fx de nyeste posteringer
 * mangler, når der er mange.
 *
 * `buildQuery` skal bygge den samme forespørgsel hver gang med en entydig
 * sortering (fx dato + id), så ingen rækker springes over eller tælles to
 * gange mellem bidderne.
 */
export async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
