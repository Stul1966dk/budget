import type { TextMappingRow, TransactionRow } from "@/lib/types/db";
import { extractMonthKey, shiftMonthKey } from "@/lib/month";
import { projectRecurringByIntervalDetailed } from "./computeExpenseForecast";

export type ForecastLineItem = {
  key: string;
  label: string;
  categoryId: string | null;
  months: number[];
  total: number;
};

export type ForecastSheet = {
  monthKeys: string[];
  incomeItems: ForecastLineItem[];
  expenseItems: ForecastLineItem[];
  otherExpenseAverage: number;
  incomeTotals: number[];
  expenseTotals: number[];
  netTotals: number[];
};

type MappingInfo = Pick<TextMappingRow, "id" | "comment" | "match_pattern" | "category_id">;

/**
 * Samme fremskrivning som computeExpenseForecast, men bevarer hver
 * mapping-regel som sin egen linje i stedet for at summere dem sammen -
 * så prognosen kan vises som et regneark med alle poster synlige, ligesom
 * man ville lægge et budget op i Excel.
 */
export function computeForecastLineItems(
  transactions: TransactionRow[],
  mappings: MappingInfo[],
  fromMonthKey: string,
  monthsAhead: number,
  discontinuedMappingIds: Set<string> = new Set(),
): ForecastSheet {
  const monthKeys = Array.from({ length: monthsAhead }, (_, i) =>
    shiftMonthKey(fromMonthKey, i + 1),
  );

  const ordinaryExpenses = transactions.filter((t) => !t.is_extraordinary && t.amount < 0);
  const ordinaryIncome = transactions.filter((t) => !t.is_extraordinary && t.amount > 0);

  const expenseDetailed = projectRecurringByIntervalDetailed(
    ordinaryExpenses,
    fromMonthKey,
    monthsAhead,
    discontinuedMappingIds,
  );
  const incomeDetailed = projectRecurringByIntervalDetailed(
    ordinaryIncome,
    fromMonthKey,
    monthsAhead,
    discontinuedMappingIds,
  );

  const mappingById = new Map(mappings.map((m) => [m.id, m]));

  function toItems(detailed: Map<string, Map<string, number>>): ForecastLineItem[] {
    return Array.from(detailed.entries())
      .map(([mappingId, monthMap]) => {
        const mapping = mappingById.get(mappingId);
        const months = monthKeys.map((mk) => Math.abs(monthMap.get(mk) ?? 0));
        return {
          key: mappingId,
          label: mapping?.comment?.trim() || mapping?.match_pattern || "Ukendt post",
          categoryId: mapping?.category_id ?? null,
          months,
          total: months.reduce((sum, v) => sum + v, 0),
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  const incomeItems = toItems(incomeDetailed);
  const expenseItems = toItems(expenseDetailed);

  const lastThree = [1, 2, 3].map((n) => shiftMonthKey(fromMonthKey, -n));
  const unmappedByMonth = new Map<string, number>();
  for (const t of ordinaryExpenses) {
    if (t.mapping_id) continue;
    const monthKey = extractMonthKey(t.date);
    unmappedByMonth.set(monthKey, (unmappedByMonth.get(monthKey) ?? 0) + Math.abs(t.amount));
  }
  const monthsWithUnmapped = lastThree.filter((mk) => unmappedByMonth.has(mk));
  const otherExpenseAverage =
    monthsWithUnmapped.length > 0
      ? monthsWithUnmapped.reduce((sum, mk) => sum + unmappedByMonth.get(mk)!, 0) /
        monthsWithUnmapped.length
      : 0;

  const incomeTotals = monthKeys.map((_, i) =>
    incomeItems.reduce((sum, item) => sum + item.months[i], 0),
  );
  const expenseTotals = monthKeys.map(
    (_, i) => expenseItems.reduce((sum, item) => sum + item.months[i], 0) + otherExpenseAverage,
  );
  const netTotals = monthKeys.map((_, i) => incomeTotals[i] - expenseTotals[i]);

  return {
    monthKeys,
    incomeItems,
    expenseItems,
    otherExpenseAverage,
    incomeTotals,
    expenseTotals,
    netTotals,
  };
}
