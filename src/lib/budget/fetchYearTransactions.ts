import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { TransactionRow } from "@/lib/types/db";

/** Henter alle årets posteringer (i bidder, så der ikke stoppes ved 1000 rækker). */
export async function fetchYearTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
): Promise<{ data: TransactionRow[] }> {
  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("transactions")
      .select(
        "id, date, amount, balance, import_seq, mapping_id, category_id, is_extraordinary, comment, raw_text",
      )
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date")
      .order("import_seq")
      .order("id")
      .range(from, to),
  );
  if (error) {
    console.error("fetchYearTransactions: kunne ikke hente posteringer:", error.code, error.message);
  }
  return { data: data as TransactionRow[] };
}
