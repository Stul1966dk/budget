import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { extractMonthKey } from "@/lib/month";

/**
 * De måneder der findes posteringer i, nyeste først (fx "2026-11").
 *
 * Bruger databasefunktionen budget.transaction_months, som klarer det i ét
 * opslag. Findes funktionen ikke (migrationen
 * 20261117090000_transaction_months_function.sql er ikke kørt endnu), falder
 * den tilbage til at hente datoen på alle posteringer, så siden virker
 * uanset hvad.
 */
export async function fetchAvailableMonths(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data, error } = await supabase.rpc("transaction_months");
  if (!error && data) {
    return (data as { month: string }[]).map((r) => r.month);
  }

  console.error("fetchAvailableMonths: transaction_months fejlede, bruger fallback:", error?.message);
  const { data: rows } = await fetchAllRows((from, to) =>
    supabase
      .from("transactions")
      .select("date")
      .order("date", { ascending: false })
      .order("id")
      .range(from, to),
  );
  return Array.from(new Set(rows.map((r: { date: string }) => extractMonthKey(r.date))));
}
