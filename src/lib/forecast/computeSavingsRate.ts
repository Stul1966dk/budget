import type { Category, TransactionRow } from "@/lib/types/db";
import { extractMonthKey } from "@/lib/month";

export type MonthlySavings = {
  monthKey: string;
  income: number;
  expenses: number;
  result: number;
  savings: number;
};

/**
 * Beregner måned-for-måned indtægt, udgifter, resultat og opsparingsbeløb
 * (posteringer i kategorier der matcher "opsparing" eller "pension") for de
 * seneste `monthsBack` måneder. Ekstraordinære posteringer indgår ikke, da de
 * ville forvride det normale billede.
 */
export function computeSavingsRate(
  transactions: TransactionRow[],
  categories: Category[],
  monthsBack = 6,
): MonthlySavings[] {
  const savingsCategoryIds = new Set(
    categories.filter((c) => /opspar|pension/i.test(c.name)).map((c) => c.id),
  );

  const ordinary = transactions.filter((t) => !t.is_extraordinary);
  const byMonth = new Map<string, TransactionRow[]>();
  for (const t of ordinary) {
    const monthKey = extractMonthKey(t.date);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(t);
  }

  const recentKeys = Array.from(byMonth.keys())
    .sort()
    .slice(-monthsBack);

  return recentKeys.map((monthKey) => {
    const txs = byMonth.get(monthKey)!;
    const income = txs
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const savings = txs
      .filter(
        (t) =>
          t.amount < 0 &&
          t.category_id !== null &&
          savingsCategoryIds.has(t.category_id),
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { monthKey, income, expenses, result: income + expenses, savings };
  });
}
