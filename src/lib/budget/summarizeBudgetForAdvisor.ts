import { formatMonthDa } from "@/lib/format";
import { monthKeyToDateRange } from "@/lib/month";
import type { BudgetLineRow, Category } from "@/lib/types/db";
import { computeBudgetTotals } from "./computeBudgetTotals";
import {
  computeBudgetActuals,
  type ActualTransaction,
  type MappingLabel,
} from "./computeBudgetActuals";
import { groupLinesByCategory } from "./groupLinesByCategory";

const TOP_DEVIATIONS = 8;
const TOP_UNBUDGETED = 8;

const round = (v: number) => Math.round(v);
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
const sumWhere = (values: number[], include: boolean[]) =>
  values.reduce((s, v, i) => (include[i] ? s + v : s), 0);
const typeLabel = (kind: "income" | "expense") => (kind === "income" ? "indtægt" : "udgift");

/** Beskriver om en afvigelse er godt eller skidt for husstanden. */
function assess(kind: "income" | "expense", diff: number): string {
  if (Math.abs(diff) < 1) return "som budgetteret";
  if (kind === "expense") return diff > 0 ? "over budget (dyrere)" : "under budget (billigere)";
  return diff > 0 ? "mere end budgetteret" : "mindre end budgetteret";
}

/**
 * Gør et årsbudget (og, når der er posteringer fra året, budget mod faktisk)
 * til en kompakt, dansksproget struktur, som AI-rådgiveren kan læse direkte.
 * Alle beløb er hele kroner uden fortegn; "forskel" er faktisk minus budget.
 */
export function summarizeBudgetForAdvisor(input: {
  year: number;
  startBalance: number | null;
  lines: BudgetLineRow[];
  categories: Category[];
  transactions: ActualTransaction[];
  mappings: MappingLabel[];
  /** Dato for den nyeste postering overhovedet - bruges til at se om seneste måned er delvis. */
  latestTransactionDate: string | null;
}) {
  const { year, lines, categories } = input;
  const totals = computeBudgetTotals(lines, input.startBalance);
  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const budgetByCategory = (["income", "expense"] as const).flatMap((kind) =>
    groupLinesByCategory(
      lines.filter((l) => l.kind === kind),
      categories,
    ).map((group) => ({
      kategori: group.category?.name ?? "Uden kategori",
      type: typeLabel(kind),
      aarsbudget: round(sum(group.lines.flatMap((l) => l.amounts))),
      poster: group.lines.map((l) => ({
        post: l.label,
        aarsbudget: round(sum(l.amounts)),
        pr_maaned: l.amounts.map(round),
      })),
    })),
  );

  const plan = {
    aar: year,
    startsaldo: input.startBalance === null ? "ukendt" : round(input.startBalance),
    indtaegter_i_alt: round(sum(totals.incomeTotals)),
    udgifter_i_alt: round(sum(totals.expenseTotals)),
    nettoresultat_for_aaret: round(sum(totals.netTotals)),
    budgetteret_saldo_ved_maanedens_slutning: monthKeys.map((mk, i) => ({
      maaned: formatMonthDa(mk),
      saldo: round(totals.balances[i]),
    })),
    budget_pr_kategori: budgetByCategory,
  };

  const actuals = computeBudgetActuals(lines, input.transactions, input.mappings, year);
  const has = actuals.monthsWithData;
  if (!has.some(Boolean)) {
    return { ...plan, budget_mod_faktisk: "Ingen posteringer fra året endnu." };
  }

  const lineActual = (l: BudgetLineRow) =>
    sumWhere(actuals.lineActuals.get(l.id) ?? [], has);
  const lineBudget = (l: BudgetLineRow) => sumWhere(l.amounts, has);

  const categoryComparison = (["income", "expense"] as const).flatMap((kind) =>
    groupLinesByCategory(
      lines.filter((l) => l.kind === kind),
      categories,
    ).map((group) => {
      const budget = sum(group.lines.map(lineBudget));
      const actual = sum(group.lines.map(lineActual));
      return {
        kategori: group.category?.name ?? "Uden kategori",
        type: typeLabel(kind),
        budget: round(budget),
        faktisk: round(actual),
        forskel: round(actual - budget),
        vurdering: assess(kind, actual - budget),
      };
    }),
  );

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const largestDeviations = lines
    .map((l) => ({ line: l, budget: lineBudget(l), actual: lineActual(l) }))
    .filter((d) => Math.abs(d.actual - d.budget) >= 1)
    .sort((a, b) => Math.abs(b.actual - b.budget) - Math.abs(a.actual - a.budget))
    .slice(0, TOP_DEVIATIONS)
    .map((d) => ({
      post: d.line.label,
      kategori: (d.line.category_id && categoryName.get(d.line.category_id)) || "Uden kategori",
      type: typeLabel(d.line.kind),
      budget: round(d.budget),
      faktisk: round(d.actual),
      forskel: round(d.actual - d.budget),
      vurdering: assess(d.line.kind, d.actual - d.budget),
      koblet_til_posteringer: d.line.mapping_ids.length > 0 || d.line.include_category,
    }));

  const comparedMonths = monthKeys.filter((_, i) => has[i]);
  const latestMonthKey = comparedMonths.at(-1)!;
  const latestIndex = monthKeys.indexOf(latestMonthKey);
  const latestIsPartial =
    input.latestTransactionDate !== null &&
    input.latestTransactionDate.startsWith(latestMonthKey) &&
    input.latestTransactionDate !== monthKeyToDateRange(latestMonthKey).end;

  const budgetNet = sumWhere(totals.netTotals, has);
  // Uden ekstraordinære poster - de står for sig under "ekstraordinaere",
  // ligesom de holdes ude af resten af rådgiverens tal.
  const actualNet =
    sumWhere(actuals.incomeTotals, has) -
    sumWhere(actuals.extraordinaryIncome, has) -
    (sumWhere(actuals.expenseTotals, has) - sumWhere(actuals.extraordinaryExpense, has));

  return {
    ...plan,
    budget_mod_faktisk: {
      sammenlignede_maaneder: comparedMonths.map(formatMonthDa),
      seneste_maaned_er_muligvis_ufuldstaendig: latestIsPartial,
      pr_kategori: categoryComparison,
      poster_med_stoerste_afvigelse: largestDeviations,
      ikke_budgetteret: {
        udgifter_i_alt: round(sumWhere(actuals.unbudgetedExpense, has)),
        indtaegter_i_alt: round(sumWhere(actuals.unbudgetedIncome, has)),
        stoerste: actuals.unbudgetedGroups
          .filter((g) => !g.isExtraordinary)
          .slice(0, TOP_UNBUDGETED)
          .map((g) => ({
            tekst: g.label,
            type: typeLabel(g.kind),
            beloeb: round(g.total),
            antal_posteringer: g.count,
          })),
      },
      ekstraordinaere: {
        udgifter_i_alt: round(sumWhere(actuals.extraordinaryExpense, has)),
        indtaegter_i_alt: round(sumWhere(actuals.extraordinaryIncome, has)),
      },
      nettoresultat_uden_ekstraordinaere: {
        budget: round(budgetNet),
        faktisk: round(actualNet),
        forskel: round(actualNet - budgetNet),
      },
      budgetteret_saldo_ved_udgangen_af_seneste_maaned: round(totals.balances[latestIndex]),
    },
  };
}

export type AdvisorBudgetSummary = ReturnType<typeof summarizeBudgetForAdvisor>;
