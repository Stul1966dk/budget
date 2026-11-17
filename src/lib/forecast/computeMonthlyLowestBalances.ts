import type { TransactionRow } from "@/lib/types/db";

/**
 * Den laveste saldo i løbet af hver måned i et givet år, ud fra bankens egen
 * løbende saldo pr. postering. Bruges til at vise, at kontoen har været i
 * minus undervejs, selvom saldoen ved månedens udgang er positiv.
 * En måned uden posteringer med kendt saldo giver `null`.
 */
export function computeMonthlyLowestBalances(
  transactions: Pick<TransactionRow, "date" | "balance">[],
  year: number,
): (number | null)[] {
  const lowest: (number | null)[] = new Array(12).fill(null);

  for (const t of transactions) {
    if (t.balance === null || t.date.slice(0, 4) !== String(year)) continue;
    const monthIndex = Number(t.date.slice(5, 7)) - 1;
    const current = lowest[monthIndex];
    if (current === null || t.balance < current) lowest[monthIndex] = t.balance;
  }

  return lowest;
}
