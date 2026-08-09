import { createClient } from "@/lib/supabase/server";
import { computeSavingsRate } from "@/lib/forecast/computeSavingsRate";
import { computeForecastLineItems } from "@/lib/forecast/computeForecastLineItems";
import { computeCategoryTrends } from "@/lib/forecast/computeCategoryTrends";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { extractMonthKey, getCurrentMonthKey } from "@/lib/month";
import { formatCurrency, formatMonthDa, formatDateDa } from "@/lib/format";
import type {
  AdvisorInsightRow,
  AdvisorMessageRow,
  Category,
  ForecastSettingsRow,
  TextMappingRow,
  TransactionRow,
} from "@/lib/types/db";
import { RefreshAdviceButton } from "./RefreshAdviceButton";
import { IncomeOverrideForm } from "./IncomeOverrideForm";
import { AdvisorNotesForm } from "./AdvisorNotesForm";
import { AdvisorChat } from "./AdvisorChat";
import { ForecastRangeSelector } from "./ForecastRangeSelector";
import { ForecastSheet } from "./ForecastSheet";

const MIN_FORECAST_MONTHS = 1;
const MAX_FORECAST_MONTHS = 36;
const DEFAULT_FORECAST_MONTHS = 12;

export default async function PrognosePage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const params = await searchParams;
  const parsedMonths = Number(params.months);
  const monthsAhead =
    Number.isFinite(parsedMonths) && parsedMonths > 0
      ? Math.min(MAX_FORECAST_MONTHS, Math.max(MIN_FORECAST_MONTHS, Math.round(parsedMonths)))
      : DEFAULT_FORECAST_MONTHS;

  const supabase = await createClient();

  const [
    { data: transactionsData },
    { data: categoriesData },
    { data: insightData },
    { data: settingsData },
    { data: mappingsData },
    { data: chatMessagesData },
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
    supabase
      .from("text_mappings")
      .select("id, comment, match_pattern, category_id, active"),
    supabase.from("advisor_messages").select("*").order("created_at"),
  ]);

  const transactions = (transactionsData ?? []) as TransactionRow[];
  const categories = (categoriesData ?? []) as Category[];
  const insight = (insightData ?? null) as AdvisorInsightRow | null;
  const settings = (settingsData ?? null) as ForecastSettingsRow | null;
  const chatMessages = (chatMessagesData ?? []) as AdvisorMessageRow[];
  const incomeOverride = settings?.monthly_income_override ?? null;
  const mappings = (mappingsData ?? []) as Pick<
    TextMappingRow,
    "id" | "comment" | "match_pattern" | "category_id" | "active"
  >[];
  const discontinuedMappingIds = new Set(
    mappings.filter((m) => !m.active).map((m) => m.id),
  );

  const latestMonthKey =
    transactions
      .map((t) => extractMonthKey(t.date))
      .sort()
      .at(-1) ?? getCurrentMonthKey();

  const currentBalance = computeCurrentBalance(transactions);
  const savings = computeSavingsRate(transactions, categories);
  const sheet = computeForecastLineItems(
    transactions,
    mappings,
    latestMonthKey,
    monthsAhead,
    discontinuedMappingIds,
  );
  const autoDetectedIncome = sheet.incomeTotals[0] ?? 0;
  const incomeTotals =
    incomeOverride !== null
      ? sheet.monthKeys.map(() => incomeOverride)
      : sheet.incomeTotals;
  const netTotals = incomeTotals.map((income, i) => income - sheet.expenseTotals[i]);
  const trends = computeCategoryTrends(transactions, categories).filter(
    (t) => t.direction !== "stable",
  );
  const extraordinaryTransactions = transactions
    .filter((t) => t.is_extraordinary)
    .sort((a, b) => b.date.localeCompare(a.date));
  const extraordinaryTotal = extraordinaryTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">Rådgiver</h1>
      <p className="mt-1 text-sm text-stone-500">
        Opsparingsrate, udgiftsprognose og kategori-trends baseret på jeres
        egne posteringer, med en kort AI-genereret anbefaling der opdateres
        ved hver ny upload - og en chat hvor I kan spørge ind til tallene.
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

      {extraordinaryTransactions.length > 0 && (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            Ekstraordinære poster i alt: {formatCurrency(extraordinaryTotal)} (
            {extraordinaryTransactions.length}) - holdes udenfor tallene ovenfor
          </summary>
          <ul className="mt-2 space-y-1">
            {extraordinaryTransactions.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {formatDateDa(t.date)} · {t.comment ?? t.raw_text}
                </span>
                <span className="whitespace-nowrap">{formatCurrency(t.amount)}</span>
              </li>
            ))}
          </ul>
          <a
            href="/maaned?filter=ekstraordinaere"
            className="mt-2 inline-block text-xs font-medium underline"
          >
            Se og redigér på Oversigt
          </a>
        </details>
      )}

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
        <AdvisorNotesForm notes={settings?.advisor_notes ?? null} />
      </div>

      <AdvisorChat messages={chatMessages} />

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-900">Opsparingsrate</h2>
        {savings.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">Ingen data endnu.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
                  <th className="px-3 py-2 font-medium">Måned</th>
                  <th className="px-2 py-2 text-right font-medium">Indtægt</th>
                  <th className="px-2 py-2 text-right font-medium">Udgifter</th>
                  <th className="px-2 py-2 text-right font-medium">Resultat</th>
                  <th className="px-3 py-2 text-right font-medium">Opsparing</th>
                </tr>
              </thead>
              <tbody>
                {savings.map((s) => (
                  <tr key={s.monthKey} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 text-stone-900">
                      {formatMonthDa(s.monthKey)}
                    </td>
                    <td className="px-2 py-2 text-right text-green-700">
                      {formatCurrency(s.income)}
                    </td>
                    <td className="px-2 py-2 text-right text-red-700">
                      {formatCurrency(s.expenses)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-medium ${
                        s.result >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(s.result)}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-700">
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
          Prognose - næste {sheet.monthKeys.length} måneder
        </h2>
        <ForecastRangeSelector months={monthsAhead} />
        <IncomeOverrideForm
          overrideValue={incomeOverride}
          autoDetectedValue={autoDetectedIncome}
        />
        {sheet.monthKeys.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">Ingen data endnu.</p>
        ) : (
          <ForecastSheet
            monthKeys={sheet.monthKeys}
            incomeItems={sheet.incomeItems}
            expenseItems={sheet.expenseItems}
            otherExpenseAverage={sheet.otherExpenseAverage}
            incomeTotals={incomeTotals}
            expenseTotals={sheet.expenseTotals}
            netTotals={netTotals}
            incomeIsOverridden={incomeOverride !== null}
          />
        )}
        <p className="mt-2 text-xs text-stone-400">
          Hver linje er en mapping-regel, projiceret på det interval den
          faktisk plejer at optræde med - månedligt, kvartalsvist,
          halvårligt osv. En post der kun er set én gang (fx en halvårlig
          afgift der endnu ikke er set to gange) kan ikke projiceres endnu.
          Øvrige udgifter er et fladt gennemsnit af ikke-genkendte
          posteringer de seneste 3 måneder - et groft skøn, ikke en garanti.
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
                  {t.direction === "increasing" ? "Steget" : "Faldet"}{" "}
                  {Math.abs(t.percentChange)}%
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-stone-400">
          Sammenligner gennemsnitsforbruget pr. kategori i første og anden
          halvdel af de seneste 6 måneder. En kategori vises kun her hvis
          forskellen er over 10% i enten retning - mindre udsving regnes som
          stabilt og vises ikke.
        </p>
      </section>
    </div>
  );
}
