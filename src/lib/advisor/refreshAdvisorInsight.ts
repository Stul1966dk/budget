import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  ForecastSettingsRow,
  TextMappingRow,
  TransactionRow,
} from "@/lib/types/db";
import { computeSavingsRate } from "@/lib/forecast/computeSavingsRate";
import { computeExpenseForecast } from "@/lib/forecast/computeExpenseForecast";
import { computeCategoryTrends } from "@/lib/forecast/computeCategoryTrends";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { applyIncomeOverride } from "@/lib/forecast/applyIncomeOverride";
import { extractMonthKey, getCurrentMonthKey } from "@/lib/month";
import { ADVISOR_MODEL, generateAdvice } from "./generateAdvice";

/**
 * Genberegner forecast/trends ud fra alle posteringer, beder Claude om en
 * kort anbefaling, og gemmer resultatet. Fejler aldrig hårdt - kaldes både
 * automatisk efter upload og manuelt fra rådgiver-siden, og skal ikke kunne
 * vælte hverken import eller sidevisning.
 */
export async function refreshAdvisorInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const [
    { data: transactionsData },
    { data: categoriesData },
    { data: settingsData },
    { data: mappingsData },
  ] = await Promise.all([
    supabase.from("transactions").select("*").order("date"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("forecast_settings").select("*").limit(1).maybeSingle(),
    supabase.from("text_mappings").select("id, active"),
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

  try {
    const content = await generateAdvice({ currentBalance, savings, forecast, trends });

    const { error } = await supabase.from("advisor_insights").insert({
      content,
      model: ADVISOR_MODEL,
    });

    if (error) {
      console.error(
        "refreshAdvisorInsight: kunne ikke gemme anbefaling:",
        error.code,
        error.message,
      );
      return null;
    }

    return content;
  } catch (err) {
    console.error("refreshAdvisorInsight: kunne ikke generere anbefaling:", err);
    return null;
  }
}
