import { createClient } from "@/lib/supabase/server";
import {
  extractMonthKey,
  getCurrentMonthKey,
  monthKeyToDateRange,
} from "@/lib/month";
import { formatCurrency } from "@/lib/format";
import type { AlertRow, Category, TransactionRow } from "@/lib/types/db";
import { MonthSelector } from "./MonthSelector";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { TransactionList } from "./TransactionList";
import { AlertsPanel } from "./AlertsPanel";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let monthKey = params.month;
  if (!monthKey) {
    const { data: latest } = await supabase
      .from("transactions")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    monthKey = latest ? extractMonthKey(latest.date) : getCurrentMonthKey();
  }

  const { start, end } = monthKeyToDateRange(monthKey);

  const [
    { data: categoriesData },
    { data: transactionsData },
    { data: monthsData },
    { data: alertsData },
  ] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("transactions")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("import_seq", { ascending: true }),
    supabase.from("transactions").select("date").order("date", { ascending: false }),
    supabase
      .from("alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false }),
  ]);

  const categories = (categoriesData ?? []) as Category[];
  const allTransactions = (transactionsData ?? []) as TransactionRow[];
  const alerts = (alertsData ?? []) as AlertRow[];

  const availableMonths = Array.from(
    new Set((monthsData ?? []).map((r) => extractMonthKey(r.date))),
  );
  if (!availableMonths.includes(monthKey)) availableMonths.push(monthKey);
  availableMonths.sort().reverse();

  const showOnlyUnmatched = params.filter === "umatchede";

  const ordinary = allTransactions.filter((t) => !t.is_extraordinary);
  const extraordinary = allTransactions.filter((t) => t.is_extraordinary);

  const income = ordinary
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = ordinary
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const result = income + expenses;
  const extraordinaryTotal = extraordinary.reduce((sum, t) => sum + t.amount, 0);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const expenseTotal = Math.abs(expenses) || 1;

  const categoryTotals = new Map<string, number>();
  for (const t of ordinary) {
    if (t.amount >= 0) continue;
    const key = t.category_id ?? "none";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Math.abs(t.amount));
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([key, sum]) => ({
      id: key,
      name:
        key === "none" ? "Ukategoriseret" : categoryMap.get(key)?.name ?? "Ukendt",
      color:
        key === "none" ? "#94a3b8" : categoryMap.get(key)?.color ?? "#94a3b8",
      sum,
      share: sum / expenseTotal,
    }))
    .sort((a, b) => b.sum - a.sum);

  const visibleTransactions = showOnlyUnmatched
    ? allTransactions.filter((t) => t.category_id === null)
    : allTransactions;

  const transactionsWithBalance = allTransactions.filter(
    (t): t is TransactionRow & { balance: number } => t.balance !== null,
  );
  const endOfPeriodBalance = transactionsWithBalance.at(-1)?.balance ?? null;
  const lowestBalanceInPeriod =
    transactionsWithBalance.length > 0
      ? Math.min(...transactionsWithBalance.map((t) => t.balance))
      : null;
  const dippedNegative =
    lowestBalanceInPeriod !== null &&
    lowestBalanceInPeriod < 0 &&
    lowestBalanceInPeriod !== endOfPeriodBalance;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <AlertsPanel alerts={alerts} />
      <MonthSelector currentMonth={monthKey} availableMonths={availableMonths} />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Indtægter" value={income} tone="positive" />
        <SummaryCard label="Udgifter" value={expenses} tone="negative" />
        <SummaryCard
          label="Resultat"
          value={result}
          tone={result >= 0 ? "positive" : "negative"}
        />
        {endOfPeriodBalance !== null && (
          <SummaryCard
            label="Saldo"
            value={endOfPeriodBalance}
            tone={endOfPeriodBalance >= 0 ? "positive" : "negative"}
          />
        )}
      </div>

      {dippedNegative && (
        <p className="mt-2 text-xs text-red-600">
          Saldoen har været i minus i perioden (laveste: {formatCurrency(lowestBalanceInPeriod!)}
          ).
        </p>
      )}

      {extraordinary.length > 0 && (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            Ekstraordinære poster: {formatCurrency(extraordinaryTotal)} (
            {extraordinary.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {extraordinary.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">{t.comment ?? t.raw_text}</span>
                <span className="whitespace-nowrap">
                  {formatCurrency(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {categoryBreakdown.length > 0 && (
        <CategoryBreakdown items={categoryBreakdown} />
      )}

      <TransactionList
        transactions={visibleTransactions}
        categories={categories}
        showOnlyUnmatched={showOnlyUnmatched}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold sm:text-base ${
          tone === "positive" ? "text-green-700" : "text-red-700"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
