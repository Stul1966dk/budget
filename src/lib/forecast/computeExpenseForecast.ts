import type { TransactionRow } from "@/lib/types/db";
import { extractMonthKey, monthDiff, shiftMonthKey } from "@/lib/month";

export type ForecastMonth = {
  monthKey: string;
  recurringTotal: number;
  averageUnmappedTotal: number;
  projectedTotal: number;
  recurringIncome: number;
  projectedNetResult: number;
};

/**
 * Finder posteringer der er tilbagevendende med et fast interval (månedligt,
 * kvartalsvist, halvårligt osv.) ud fra deres egen historik, og projicerer
 * dem frem på de konkrete fremtidige måneder de forventes at optræde igen -
 * ikke fladt på hver måned. Kræver mindst 2 tidligere forekomster af samme
 * mapping-regel for at kunne udlede et interval; en post der kun er set én
 * gang kan ikke placeres i fremtiden med sikkerhed.
 *
 * En regel der er "for sent på den" ift. sit eget mønster (fx en halvårlig
 * post der ikke er set i over halvanden gange sit interval) regnes som
 * ophørt og projiceres ikke videre. Regler i `discontinuedMappingIds`
 * (manuelt markeret som afsluttet, fx fordi huset er solgt) ignoreres helt,
 * uanset deres historiske mønster.
 *
 * Returnerer beløb pr. mapping-regel, pr. måned den er forventet - bevarer
 * detaljen pr. regel, så den kan vises som selvstændig linje i et regneark
 * (se computeForecastLineItems) eller summeres til ét tal (se sumByMonth).
 */
export function projectRecurringByIntervalDetailed(
  rows: TransactionRow[],
  fromMonthKey: string,
  monthsAhead: number,
  discontinuedMappingIds: Set<string>,
): Map<string, Map<string, number>> {
  const mappingMonthAmount = new Map<string, Map<string, number>>();
  for (const t of rows) {
    if (!t.mapping_id || discontinuedMappingIds.has(t.mapping_id)) continue;
    const monthKey = extractMonthKey(t.date);
    if (!mappingMonthAmount.has(t.mapping_id)) {
      mappingMonthAmount.set(t.mapping_id, new Map());
    }
    const monthMap = mappingMonthAmount.get(t.mapping_id)!;
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + t.amount);
  }

  const projectedByMapping = new Map<string, Map<string, number>>();

  for (const [mappingId, monthMap] of mappingMonthAmount.entries()) {
    const occurrences = Array.from(monthMap.keys()).sort();
    if (occurrences.length < 2) continue;

    const lastOccurrence = occurrences.at(-1)!;
    const secondLastOccurrence = occurrences.at(-2)!;
    const interval = monthDiff(secondLastOccurrence, lastOccurrence);
    if (interval < 1) continue;

    if (monthDiff(lastOccurrence, fromMonthKey) > interval * 1.5) continue;

    const amount = monthMap.get(lastOccurrence)!;
    const dueMonths = new Map<string, number>();

    let due = shiftMonthKey(lastOccurrence, interval);
    while (monthDiff(fromMonthKey, due) <= monthsAhead) {
      if (monthDiff(fromMonthKey, due) >= 1) {
        dueMonths.set(due, (dueMonths.get(due) ?? 0) + amount);
      }
      due = shiftMonthKey(due, interval);
    }

    if (dueMonths.size > 0) {
      projectedByMapping.set(mappingId, dueMonths);
    }
  }

  return projectedByMapping;
}

function sumByMonth(detailed: Map<string, Map<string, number>>): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const monthMap of detailed.values()) {
    for (const [monthKey, amount] of monthMap.entries()) {
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + amount);
    }
  }
  return byMonth;
}

/**
 * Projicerer forventede udgifter OG indbetalinger for de kommende
 * `monthsAhead` måneder ud fra `fromMonthKey`, summeret til ét tal pr.
 * måned. Se `computeForecastLineItems` for en linje-for-linje udgave.
 */
export function computeExpenseForecast(
  transactions: TransactionRow[],
  fromMonthKey: string,
  monthsAhead = 3,
  discontinuedMappingIds: Set<string> = new Set(),
): ForecastMonth[] {
  const ordinaryExpenses = transactions.filter((t) => !t.is_extraordinary && t.amount < 0);
  const ordinaryIncome = transactions.filter((t) => !t.is_extraordinary && t.amount > 0);
  const lastThree = [1, 2, 3].map((n) => shiftMonthKey(fromMonthKey, -n));

  const recurringExpenseByMonth = sumByMonth(
    projectRecurringByIntervalDetailed(
      ordinaryExpenses,
      fromMonthKey,
      monthsAhead,
      discontinuedMappingIds,
    ),
  );
  const recurringIncomeByMonth = sumByMonth(
    projectRecurringByIntervalDetailed(
      ordinaryIncome,
      fromMonthKey,
      monthsAhead,
      discontinuedMappingIds,
    ),
  );

  const unmappedByMonth = new Map<string, number>();
  for (const t of ordinaryExpenses) {
    if (t.mapping_id) continue;
    const monthKey = extractMonthKey(t.date);
    unmappedByMonth.set(monthKey, (unmappedByMonth.get(monthKey) ?? 0) + Math.abs(t.amount));
  }
  const monthsWithUnmapped = lastThree.filter((mk) => unmappedByMonth.has(mk));
  const averageUnmappedTotal =
    monthsWithUnmapped.length > 0
      ? monthsWithUnmapped.reduce((sum, mk) => sum + unmappedByMonth.get(mk)!, 0) /
        monthsWithUnmapped.length
      : 0;

  return Array.from({ length: monthsAhead }, (_, i) => {
    const monthKey = shiftMonthKey(fromMonthKey, i + 1);
    const recurringTotal = Math.abs(recurringExpenseByMonth.get(monthKey) ?? 0);
    const recurringIncome = recurringIncomeByMonth.get(monthKey) ?? 0;
    const projectedTotal = recurringTotal + averageUnmappedTotal;
    return {
      monthKey,
      recurringTotal,
      averageUnmappedTotal,
      projectedTotal,
      recurringIncome,
      projectedNetResult: recurringIncome - projectedTotal,
    };
  });
}
