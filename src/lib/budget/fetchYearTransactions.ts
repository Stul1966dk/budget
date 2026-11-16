import type { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "@/lib/types/db";

const PAGE_SIZE = 1000;

/** Henter alle årets posteringer - i bidder, da Supabase højst giver 1000 rækker ad gangen. */
export async function fetchYearTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
): Promise<{ data: TransactionRow[] }> {
  const rows: TransactionRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, date, amount, balance, import_seq, mapping_id, category_id, is_extraordinary, comment, raw_text",
      )
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date")
      .order("import_seq")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("fetchYearTransactions: kunne ikke hente posteringer:", error.code, error.message);
      break;
    }
    rows.push(...((data ?? []) as TransactionRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows };
}
