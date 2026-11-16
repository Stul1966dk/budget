import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BudgetLineRow, BudgetRow, Category } from "@/lib/types/db";
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
  if (budget) {
    const { data: linesData } = await supabase
      .from("budget_lines")
      .select("*")
      .eq("budget_id", budget.id)
      .order("sort_order")
      .order("created_at");
    lines = ((linesData ?? []) as BudgetLineRow[]).map((l) => ({
      ...l,
      amounts: l.amounts.map(Number),
    }));
  }

  const chipYears = budget || years.includes(selectedYear)
    ? years
    : [...years, selectedYear].sort((a, b) => a - b);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-stone-900">Budget</h1>
      <p className="mt-1 text-sm text-stone-500">
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
            className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900"
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
