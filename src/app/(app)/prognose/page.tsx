import { createClient } from "@/lib/supabase/server";
import { computeSavingsRate } from "@/lib/forecast/computeSavingsRate";
import { computeExpenseForecast } from "@/lib/forecast/computeExpenseForecast";
import { computeCategoryTrends } from "@/lib/forecast/computeCategoryTrends";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { applyIncomeOverride } from "@/lib/forecast/applyIncomeOverride";
import { extractMonthKey, getCurrentMonthKey } from "@/lib/month";
import { formatCurrency, formatDateDa, formatMonthDa } from "@/lib/format";
import type {
  AdvisorInsightRow,
  Category,
  ForecastSettingsRow,
  TextMappingRow,
  TransactionRow,
} from "@/lib/types/db";
import { RefreshAdviceButton } from "./RefreshAdviceButton";
import { IncomeOverrideForm } from "./IncomeOverrideForm";

export default async function PrognosePage() {
  const supabase = await createClient();

  const [
    { data: transactionsData },
    { data: categoriesData },
    { data: insightData },
    { data: settingsData },
    { data: mappingsData },
  ] = await Promise.all([
    supabase.from("transactions").select("*").order("date"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("advisor_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("forecast_settings").select("*").limit(1).maybeSingle(),
    supabase.from("text_mappings").select("id, active"),
  ]);

  const transactions = (transactionsData ?? []) as TransactionRow[];
  const categories = (categoriesData ?? []) as Category[];
  const insight = (insightData ?? null) as AdvisorInsightRow | null;
  const settings = (settingsData ?? null) as ForecastSettingsRow | null;
  const incomeOverride = settings?.monthly_income_override ?? null;
  const discontinuedMappingIds = new Set(
    ((mappingsData ?? []) as Pick<TextMappingRow, "id" | "active">[])
      .filter((m) => !m.active)
      .map((m) => m.id),
  );

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
    12,
    discontinuedMappingIds,
  );
  const autoDetectedIncome = rawForecast[0]?.recurringIncome ?? 0;
  const forecast = applyIncomeOverride(rawForecast, incomeOverride);
  const forecastNetTotal = forecast.reduce((sum, f) => sum + f.projectedNetResult, 0);
  const trends = computeCategoryTrends(transactions, categories).filter(
    (t) => t.direction !== "stable",
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">Rådgiver</h1>
      <p className="mt-1 text-sm text-stone-500">
        Opsparingsrate, udgiftsprognose og kategori-trends baseret på jeres
        egne posteringer, med en kort AI-genereret anbefaling der opdateres
        ved hver ny upload.
      </p>

      <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3">
        <span className="text-xs text-stone-500">Nuværende saldo</span>
        <span
          className={`text-base font-semibold ${
            currentBalance !== null && currentBalance >= 0
              ? "text-green-700"
              : "text-red-700"
          }`}
        >
          {currentBalance !== null ? formatCurrency(currentBalance) : "Ukendt"}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Anbefaling</h2>
          <RefreshAdviceButton />
        </div>
        {insight ? (
          <>
            <p className="mt-3 whitespace-pre-line text-sm text-stone-700">
              {insight.content}
            </p>
            <p className="mt-3 text-xs text-stone-400">
              Genereret {formatDateDa(insight.created_at.slice(0, 10))} (
              {insight.model})
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-400">
            Ingen anbefaling endnu. Upload en CSV-fil, eller klik &quot;Opdater
            anbefaling&quot; for at generere en nu.
          </p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-900">Opsparingsrate</h2>
        {savings.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">Ingen data endnu.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-400">
                  <th className="px-4 py-2 font-medium">Måned</th>
                  <th className="px-4 py-2 text-right font-medium">Indtægt</th>
                  <th className="px-4 py-2 text-right font-medium">Udgifter</th>
                  <th className="px-4 py-2 text-right font-medium">Resultat</th>
                  <th className="px-4 py-2 text-right font-medium">Opsparing</th>
                </tr>
              </thead>
              <tbody>
                {savings.map((s) => (
                  <tr key={s.monthKey} className="border-t border-stone-100">
                    <td className="px-4 py-2 text-stone-900">
                      {formatMonthDa(s.monthKey)}
                    </td>
                    <td className="px-4 py-2 text-right text-green-700">
                      {formatCurrency(s.income)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-700">
                      {formatCurrency(s.expenses)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        s.result >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(s.result)}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-700">
                      {formatCurrency(s.savings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-900">
          Prognose - næste {forecast.length} måneder
        </h2>
        <IncomeOverrideForm
          overrideValue={incomeOverride}
          autoDetectedValue={autoDetectedIncome}
        />
        {forecast.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">Ingen data endnu.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-stone-400">
                  <th className="px-4 py-2 font-medium">Måned</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Indbetaling
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Faste udgifter
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Øvrige (gns.)
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Nettoresultat
                  </th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.monthKey} className="border-t border-stone-100">
                    <td className="px-4 py-2 text-stone-900">
                      {formatMonthDa(f.monthKey)}
                    </td>
                    <td className="px-4 py-2 text-right text-green-700">
                      {formatCurrency(f.recurringIncome)}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-700">
                      {formatCurrency(f.recurringTotal)}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-700">
                      {formatCurrency(f.averageUnmappedTotal)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        f.projectedNetResult >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(f.projectedNetResult)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 bg-stone-100">
                  <td className="px-4 py-2 font-medium text-stone-900" colSpan={4}>
                    Samlet forventet nettoresultat over {forecast.length} måneder
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      forecastNetTotal >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatCurrency(forecastNetTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-400">
          Indbetaling og faste udgifter er projiceret ud fra jeres
          mapping-regler, hver på det interval de faktisk plejer at optræde
          med - månedligt, kvartalsvist, halvårligt osv. En post der kun er
          set én gang (fx en halvårlig afgift der endnu ikke er set to
          gange) kan ikke projiceres endnu. Øvrige udgifter er et fladt
          gennemsnit af ikke-genkendte posteringer de seneste 3 måneder - et
          groft skøn, ikke en garanti.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-900">Kategori-trends</h2>
        {trends.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">
            Ingen kategorier viser en tydelig stigende eller faldende trend
            endnu.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {trends.map((t) => (
              <li
                key={t.categoryId}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="text-stone-900">{t.categoryName}</span>
                <span
                  className={`font-medium ${
                    t.direction === "increasing" ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {t.direction === "increasing" ? "↑" : "↓"}{" "}
                  {Math.abs(t.percentChange)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
