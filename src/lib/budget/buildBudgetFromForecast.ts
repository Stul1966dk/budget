import type { BudgetLineKind, TextMappingRow, TransactionRow } from "@/lib/types/db";
import { computeForecastLineItems } from "@/lib/forecast/computeForecastLineItems";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { extractMonthKey, getCurrentMonthKey, monthDiff } from "@/lib/month";

export type DraftBudgetLine = {
  kind: BudgetLineKind;
  label: string;
  categoryId: string | null;
  mappingId: string | null;
  amounts: number[];
};

export type DraftBudget = {
  lines: DraftBudgetLine[];
  startBalance: number | null;
};

type MappingInfo = Pick<
  TextMappingRow,
  "id" | "comment" | "match_pattern" | "category_id" | "active"
>;

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

/**
 * Laver et udkast til et årsbudget ud fra den samme fremskrivning som
 * prognosen på Rådgiver-siden: én linje pr. mapping-regel, plus "Øvrige
 * udgifter" og evt. den manuelle indbetaling.
 *
 * Prognosen starter måneden efter den seneste postering. Ligger nogle af
 * årets måneder før det (fx når man laver budget for indeværende år), bruges
 * den første fremskrevne måned med samme månedsnummer i stedet - så en
 * kvartalsvis post stadig lander i de rigtige måneder.
 */
export function buildBudgetFromForecast(
  transactions: TransactionRow[],
  mappings: MappingInfo[],
  incomeOverride: number | null,
  year: number,
): DraftBudget {
  const latestMonthKey =
    transactions
      .map((t) => extractMonthKey(t.date))
      .sort()
      .at(-1) ?? getCurrentMonthKey();

  const monthsAhead = Math.max(12, monthDiff(latestMonthKey, `${year}-12`));
  const discontinued = new Set(mappings.filter((m) => !m.active).map((m) => m.id));
  const sheet = computeForecastLineItems(
    transactions,
    mappings,
    latestMonthKey,
    monthsAhead,
    discontinued,
  );

  function pickYear(values: number[]): number[] {
    return MONTH_NUMBERS.map((mm) => {
      let index = sheet.monthKeys.indexOf(`${year}-${mm}`);
      if (index < 0) index = sheet.monthKeys.findIndex((k) => k.endsWith(`-${mm}`));
      return Math.round(values[index] ?? 0);
    });
  }

  const mappingById = new Map(mappings.map((m) => [m.id, m]));
  const lines: DraftBudgetLine[] = [];

  if (incomeOverride !== null) {
    lines.push({
      kind: "income",
      label: "Indbetalinger",
      categoryId: null,
      mappingId: null,
      amounts: Array.from({ length: 12 }, () => Math.round(incomeOverride)),
    });
  } else {
    for (const item of sheet.incomeItems) {
      lines.push({
        kind: "income",
        label: item.label,
        categoryId: item.categoryId,
        mappingId: mappingById.has(item.key) ? item.key : null,
        amounts: pickYear(item.months),
      });
    }
  }

  for (const item of sheet.expenseItems) {
    lines.push({
      kind: "expense",
      label: item.label,
      categoryId: item.categoryId,
      mappingId: mappingById.has(item.key) ? item.key : null,
      amounts: pickYear(item.months),
    });
  }

  if (sheet.otherExpenseAverage > 0) {
    lines.push({
      kind: "expense",
      label: "Øvrige udgifter",
      categoryId: null,
      mappingId: null,
      amounts: Array.from({ length: 12 }, () => Math.round(sheet.otherExpenseAverage)),
    });
  }

  const nonEmptyLines = lines.filter((l) => l.amounts.some((a) => a !== 0));

  // Startsaldo = nuværende saldo + forventet nettoresultat for månederne
  // mellem seneste postering og årets start.
  const currentBalance = computeCurrentBalance(transactions);
  let startBalance: number | null = null;
  if (currentBalance !== null) {
    const firstKeyOfYear = `${year}-01`;
    const netBeforeYear = sheet.monthKeys.reduce((sum, mk, i) => {
      if (mk >= firstKeyOfYear) return sum;
      const income = incomeOverride ?? sheet.incomeTotals[i];
      return sum + income - sheet.expenseTotals[i];
    }, 0);
    startBalance = Math.round(currentBalance + netBeforeYear);
  }

  return { lines: nonEmptyLines, startBalance };
}
