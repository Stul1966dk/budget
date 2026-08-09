import { createClient } from "@/lib/supabase/server";
import type {
  AlertRow,
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

export type BudgetSnapshot = {
  currentBalance: number | null;
  savings: MonthlySavings[];
  forecast: ForecastMonth[];
  trends: CategoryTrend[];
  incomeOverride: number | null;
  advisorNotes: string | null;
  recentAlertMessages: string[];
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
    supabase.from("transactions").select("*").order("date"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("forecast_settings").select("*").limit(1).maybeSingle(),
    supabase.from("text_mappings").select("id, active"),
    supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(15),
  ]);

  const transactions = (transactionsData ?? []) as TransactionRow[];
  const categories = (categoriesData ?? []) as Category[];
  const settings = (settingsData ?? null) as ForecastSettingsRow | null;
  const discontinuedMappingIds = new Set(
    ((mappingsData ?? []) as Pick<TextMappingRow, "id" | "active">[])
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
  const trends = computeCategoryTrends(transactions, categories);
  const recentAlertMessages = ((alertsData ?? []) as AlertRow[]).map(composeAlertMessage);

  return {
    currentBalance,
    savings,
    forecast,
    trends,
    incomeOverride: settings?.monthly_income_override ?? null,
    advisorNotes: settings?.advisor_notes ?? null,
    recentAlertMessages,
  };
}
