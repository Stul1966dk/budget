import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type {
  AlertRow,
  BudgetLineRow,
  BudgetRow,
  Category,
  ForecastSettingsRow,
  TextMappingRow,
  TransactionRow,
} from "@/lib/types/db";
import { computeSavingsRate, type MonthlySavings } from "@/lib/forecast/computeSavingsRate";
import { computeExpenseForecast, type ForecastMonth } from "@/lib/forecast/computeExpenseForecast";
import { computeCategoryTrends, type CategoryTrend } from "@/lib/forecast/computeCategoryTrends";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { applyIncomeOverride } from "@/lib/forecast/applyIncomeOverride";
import { composeAlertMessage } from "@/lib/alerts/composeAlertMessage";
import { extractMonthKey, getCurrentMonthKey } from "@/lib/month";
import { resolveAdvisorModel } from "./advisorClient";
import { fetchYearTransactions } from "@/lib/budget/fetchYearTransactions";
import {
  summarizeBudgetForAdvisor,
  type AdvisorBudgetSummary,
} from "@/lib/budget/summarizeBudgetForAdvisor";

export type BudgetSnapshot = {
  currentBalance: number | null;
  savings: MonthlySavings[];
  forecast: ForecastMonth[];
  /** Forventet saldo ved udgangen af hver måned i `forecast` - nuværende
   * saldo plus det akkumulerede forventede nettoresultat. Samme tal som vises
   * i "Forventet saldo" på Rådgiver-siden, beregnet ét sted så AI'en ikke
   * selv skal lægge måneder sammen. */
  projectedBalances: number[];
  trends: CategoryTrend[];
  incomeOverride: number | null;
  advisorNotes: string | null;
  /** Modellen husstanden har valgt under Rådgiver, ellers standarden. */
  advisorModel: string;
  recentAlertMessages: string[];
  /** Husstandens egne budgetter for indeværende og næste år (hvis de findes),
   * inkl. budget mod faktisk for de måneder der er uploadet. */
  budgets: AdvisorBudgetSummary[];
};

/**
 * Henter og genberegner det fælles talgrundlag AI-rådgiveren bruger - både
 * til den korte anbefaling efter upload og til den løbende chat. Ét sted at
 * hente/beregne fra, så de to altid tager udgangspunkt i præcis samme tal.
 */
export async function buildBudgetSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<BudgetSnapshot | null> {
  const [
    { data: transactionsData },
    { data: categoriesData },
    { data: settingsData },
    { data: mappingsData },
    { data: alertsData },
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from("transactions").select("*").order("date").order("id").range(from, to),
    ),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("forecast_settings").select("*").limit(1).maybeSingle(),
    supabase.from("text_mappings").select("id, comment, match_pattern, active"),
    supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(15),
  ]);

  const transactions = (transactionsData ?? []) as TransactionRow[];
  const categories = (categoriesData ?? []) as Category[];
  const settings = (settingsData ?? null) as ForecastSettingsRow | null;
  const mappings = (mappingsData ?? []) as Pick<
    TextMappingRow,
    "id" | "comment" | "match_pattern" | "active"
  >[];
  const discontinuedMappingIds = new Set(
    mappings
      .filter((m) => !m.active)
      .map((m) => m.id),
  );

  if (transactions.length === 0) return null;

  const latestMonthKey =
    transactions
      .map((t) => extractMonthKey(t.date))
      .sort()
      .at(-1) ?? getCurrentMonthKey();

  const currentBalance = computeCurrentBalance(transactions);
  const savings = computeSavingsRate(transactions, categories);
  const rawForecast = computeExpenseForecast(
    transactions,
    latestMonthKey,
    3,
    discontinuedMappingIds,
  );
  const forecast = applyIncomeOverride(rawForecast, settings?.monthly_income_override ?? null);
  const projectedBalances = forecast.reduce<number[]>((acc, f, i) => {
    const previous = i === 0 ? currentBalance ?? 0 : acc[i - 1];
    acc.push(previous + f.projectedNetResult);
    return acc;
  }, []);
  const trends = computeCategoryTrends(transactions, categories);
  const recentAlertMessages = ((alertsData ?? []) as AlertRow[]).map(composeAlertMessage);
  const budgets = await loadBudgetSummaries(
    supabase,
    Number(latestMonthKey.slice(0, 4)),
    categories,
    mappings.map((m) => ({ id: m.id, label: m.comment?.trim() || m.match_pattern })),
    transactions.map((t) => t.date).sort().at(-1) ?? null,
  );

  return {
    currentBalance,
    savings,
    forecast,
    projectedBalances,
    trends,
    incomeOverride: settings?.monthly_income_override ?? null,
    advisorNotes: settings?.advisor_notes ?? null,
    advisorModel: resolveAdvisorModel(settings?.advisor_model),
    recentAlertMessages,
    budgets,
  };
}

/**
 * Indeværende års budget (med budget mod faktisk) og næste års budget, hvis
 * husstanden har lagt dem. Fejl her må ikke vælte rådgiveren - så sendes
 * bare ingen budgetter med.
 */
async function loadBudgetSummaries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentYear: number,
  categories: Category[],
  mappings: { id: string; label: string }[],
  latestTransactionDate: string | null,
): Promise<AdvisorBudgetSummary[]> {
  const { data: budgetsData, error } = await supabase
    .from("budgets")
    .select("*")
    .in("year", [currentYear, currentYear + 1])
    .order("year");
  if (error) {
    console.error("buildBudgetSnapshot: kunne ikke hente budgetter:", error.code, error.message);
    return [];
  }

  const summaries: AdvisorBudgetSummary[] = [];
  for (const budget of (budgetsData ?? []) as BudgetRow[]) {
    const [{ data: linesData }, { data: yearTransactions }] = await Promise.all([
      supabase
        .from("budget_lines")
        .select("*")
        .eq("budget_id", budget.id)
        .order("sort_order")
        .order("created_at"),
      fetchYearTransactions(supabase, budget.year),
    ]);
    const lines = ((linesData ?? []) as BudgetLineRow[]).map((l) => ({
      ...l,
      amounts: l.amounts.map(Number),
      mapping_ids: l.mapping_ids ?? [],
    }));
    summaries.push(
      summarizeBudgetForAdvisor({
        year: budget.year,
        startBalance: budget.start_balance === null ? null : Number(budget.start_balance),
        lines,
        categories,
        transactions: yearTransactions.map((t) => ({ ...t, amount: Number(t.amount) })),
        mappings,
        latestTransactionDate,
      }),
    );
  }
  return summaries;
}
