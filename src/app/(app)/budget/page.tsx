import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BudgetLineRow, BudgetRow, Category, TextMappingRow, TransactionRow } from "@/lib/types/db";
import { computeMonthlyBalances } from "@/lib/forecast/computeMonthlyBalances";
import { monthKeyToDateRange } from "@/lib/month";
import type { ActualTransaction } from "@/lib/budget/computeBudgetActuals";
import { fetchYearTransactions } from "@/lib/budget/fetchYearTransactions";
import type { MappingOption } from "./ActualLinkSection";
import { BudgetEditor } from "./BudgetEditor";
import { CreateBudgetPanel } from "./CreateBudgetPanel";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: budgetsData }, { data: categoriesData }] = await Promise.all([
    supabase.from("budgets").select("*").order("year"),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  const budgets = ((budgetsData ?? []) as BudgetRow[]).map((b) => ({
    ...b,
    start_balance: b.start_balance === null ? null : Number(b.start_balance),
  }));
  const categories = (categoriesData ?? []) as Category[];
  const years = budgets.map((b) => b.year);

  const currentYear = new Date().getFullYear();
  const requestedYear = Number(params.year);
  const selectedYear =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : (years.at(-1) ?? currentYear + 1);
  const nextNewYear = Math.max(currentYear + 1, (years.at(-1) ?? currentYear) + 1);

  const budget = budgets.find((b) => b.year === selectedYear) ?? null;

  let lines: BudgetLineRow[] = [];
  let mappings: MappingOption[] = [];
  let transactions: ActualTransaction[] = [];
  let actualBalances: (number | null)[] = [];
  let partialMonthIndex: number | null = null;
  if (budget) {
    const [{ data: linesData }, { data: mappingsData }, { data: txData }, { data: latestTx }] =
      await Promise.all([
        supabase
          .from("budget_lines")
          .select("*")
          .eq("budget_id", budget.id)
          .order("sort_order")
          .order("created_at"),
        supabase.from("text_mappings").select("id, comment, match_pattern, active"),
        fetchYearTransactions(supabase, budget.year),
        supabase
          .from("transactions")
          .select("date")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    lines = ((linesData ?? []) as BudgetLineRow[]).map((l) => ({
      ...l,
      amounts: l.amounts.map(Number),
      mapping_ids: l.mapping_ids ?? [],
    }));
    mappings = (
      (mappingsData ?? []) as Pick<TextMappingRow, "id" | "comment" | "match_pattern" | "active">[]
    )
      .map((m) => ({
        id: m.id,
        label: m.comment?.trim() || m.match_pattern,
        pattern: m.match_pattern,
        active: m.active,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "da"));

    const yearTransactions = ((txData ?? []) as TransactionRow[]).map((t) => ({
      ...t,
      amount: Number(t.amount),
      balance: t.balance === null ? null : Number(t.balance),
    }));
    actualBalances = computeMonthlyBalances(yearTransactions, budget.year);
    transactions = yearTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      mapping_id: t.mapping_id,
      category_id: t.category_id,
      is_extraordinary: t.is_extraordinary,
      comment: t.comment,
      raw_text: t.raw_text,
    }));

    // Den seneste uploadede måned er typisk kun delvist med.
    const latestDate = (latestTx?.date as string | undefined) ?? null;
    if (latestDate?.startsWith(`${budget.year}-`)) {
      const monthKey = latestDate.slice(0, 7);
      if (latestDate !== monthKeyToDateRange(monthKey).end) {
        partialMonthIndex = Number(latestDate.slice(5, 7)) - 1;
      }
    }
  }

  const chipYears = budget || years.includes(selectedYear)
    ? years
    : [...years, selectedYear].sort((a, b) => a - b);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-white">Budget</h1>
      <p className="mt-1 text-sm text-white/80">
        Læg budget for et år med jeres egne tal. Start ud fra prognosen eller
        sidste års budget, og ret, tilføj og slet poster. Tidligere års
        budgetter bliver gemt.
      </p>

      <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Vælg budgetår">
        {chipYears.map((y) => {
          const isActive = y === selectedYear;
          const exists = years.includes(y);
          return (
            <Link
              key={y}
              href={`/budget?year=${y}`}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                isActive
                  ? "border-forest-900 bg-forest-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              {y}
              {!exists && " (nyt)"}
            </Link>
          );
        })}
        {!chipYears.includes(nextNewYear) && (
          <Link
            href={`/budget?year=${nextNewYear}`}
            className="rounded-full border border-dashed border-white/50 px-3 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            + Nyt budget
          </Link>
        )}
      </nav>

      {budget ? (
        <BudgetEditor
          key={budget.id}
          budget={budget}
          initialLines={lines}
          categories={categories}
          mappings={mappings}
          transactions={transactions}
          actualBalances={actualBalances}
          partialMonthIndex={partialMonthIndex}
        />
      ) : (
        <CreateBudgetPanel
          key={selectedYear}
          year={selectedYear}
          existingYears={years}
        />
      )}
    </div>
  );
}
