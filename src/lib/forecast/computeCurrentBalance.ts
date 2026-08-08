import type { TransactionRow } from "@/lib/types/db";

/**
 * Finder den senest kendte kontosaldo ud fra alle posteringer, uanset
 * hvilken rækkefølge de er hentet i. Danske Bank-CSV'en har kun dato, ikke
 * klokkeslæt, så flere posteringer samme dag kan ikke skelnes på date alene
 * - import_seq (rækkefølgen de blev indsat i, som følger CSV-filens egen
 * rækkefølge) bruges som sekundær sortering for at finde den faktisk
 * seneste postering på den seneste dato.
 */
export function computeCurrentBalance(transactions: TransactionRow[]): number | null {
  const withBalance = transactions.filter(
    (t): t is TransactionRow & { balance: number } => t.balance !== null,
  );
  if (withBalance.length === 0) return null;

  return [...withBalance]
    .sort((a, b) => a.date.localeCompare(b.date) || a.import_seq - b.import_seq)
    .at(-1)!.balance;
}
