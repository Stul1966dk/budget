import type { TransactionRow } from "@/lib/types/db";

/**
 * Saldoen ved udgangen af hver måned i et givet år, ud fra bankens egen
 * løbende saldo pr. postering (ikke genberegnet ud fra ind-/udbetalinger) -
 * garanteret at matche kontoudtoget præcist, inklusive ekstraordinære poster.
 * En måned uden posteringer med kendt saldo giver `null` ("ukendt"), ikke 0.
 */
export function computeMonthlyBalances(
  transactions: Pick<TransactionRow, "date" | "balance" | "import_seq">[],
  year: number,
): (number | null)[] {
  const withBalance = transactions.filter(
    (t): t is TransactionRow & { balance: number } =>
      t.balance !== null && t.date.slice(0, 4) === String(year),
  );

  const sorted = [...withBalance].sort(
    (a, b) => a.date.localeCompare(b.date) || a.import_seq - b.import_seq,
  );

  const monthlyBalances: (number | null)[] = new Array(12).fill(null);
  for (const t of sorted) {
    const monthIndex = Number(t.date.slice(5, 7)) - 1;
    monthlyBalances[monthIndex] = t.balance;
  }

  return monthlyBalances;
}
