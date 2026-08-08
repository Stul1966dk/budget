import type { Category, TransactionRow } from "@/lib/types/db";
import { extractMonthKey } from "@/lib/month";

export type MonthlySavings = {
  monthKey: string;
  income: number;
  expenses: number;
  result: number;
  savings: number;
};

const SAVINGS_PATTERN = /opspar|pension/i;

/**
 * Beregner måned-for-måned indtægt, udgifter, resultat og opsparingsbeløb
 * for de seneste `monthsBack` måneder. Ekstraordinære posteringer indgår
 * ikke, da de ville forvride det normale billede.
 *
 * En postering tæller som opsparing hvis enten dens kategori-navn matcher
 * "opsparing"/"pension", ELLER dens kommentar/rå tekst gør det - fx
 * "Overførsel til opsparing" som er kategoriseret som Overførsler (jf.
 * seed-reglerne for interne overførsler), ikke Pension/Opsparing. Kategori
 * alene ville overse den slags interne opsparingsoverførsler.
 */
export function computeSavingsRate(
  transactions: TransactionRow[],
  categories: Category[],
  monthsBack = 6,
): MonthlySavings[] {
  const savingsCategoryIds = new Set(
    categories.filter((c) => SAVINGS_PATTERN.test(c.name)).map((c) => c.id),
  );

  const isSavingsTransaction = (t: TransactionRow) =>
    (t.category_id !== null && savingsCategoryIds.has(t.category_id)) ||
    SAVINGS_PATTERN.test(t.comment ?? t.raw_text);

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
      .filter((t) => t.amount < 0 && isSavingsTransaction(t))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return { monthKey, income, expenses, result: income + expenses, savings };
  });
}
