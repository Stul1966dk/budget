import type { TransactionRow } from "@/lib/types/db";

/**
 * Finder den senest kendte kontosaldo ud fra alle posteringer, uanset
 * hvilken rækkefølge de er hentet i.
 */
export function computeCurrentBalance(transactions: TransactionRow[]): number | null {
  const withBalance = transactions.filter(
    (t): t is TransactionRow & { balance: number } => t.balance !== null,
  );
  if (withBalance.length === 0) return null;

  return [...withBalance].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.balance;
}
