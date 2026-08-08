import { createClient } from "@/lib/supabase/server";
import type { Category, TransactionRow } from "@/lib/types/db";
import { YearSelector } from "./aar/YearSelector";
import { YearTable, type YearTableCategory } from "./aar/YearTable";

type YearTransaction = Pick<
  TransactionRow,
  "date" | "amount" | "category_id" | "is_extraordinary" | "raw_text" | "comment" | "mapping_id"
>;

export default async function AarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let year = params.year ? Number(params.year) : NaN;
  if (!Number.isFinite(year)) {
    const { data: latest } = await supabase
      .from("transactions")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    year = latest ? Number(latest.date.slice(0, 4)) : new Date().getFullYear();
  }

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [{ data: categoriesData }, { data: transactionsData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("transactions")
      .select("date, amount, category_id, is_extraordinary, raw_text, comment, mapping_id")
      .gte("date", start)
      .lte("date", end)
      .eq("is_extraordinary", false),
  ]);

  const categories = (categoriesData ?? []) as Category[];
  const transactions = (transactionsData ?? []) as YearTransaction[];
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const categoryGrid = new Map<string, number[]>();
  const itemGrid = new Map<string, Map<string, { label: string; months: number[] }>>();

  function bucket(map: Map<string, number[]>, key: string): number[] {
    let months = map.get(key);
    if (!months) {
      months = new Array(12).fill(0);
      map.set(key, months);
    }
    return months;
  }

  for (const t of transactions) {
    if (t.amount >= 0) continue; // årsoversigten viser kun udgifter
    const monthIndex = Number(t.date.slice(5, 7)) - 1;
    const categoryKey = t.category_id ?? "none";
    const amount = Math.abs(t.amount);

    bucket(categoryGrid, categoryKey)[monthIndex] += amount;

    if (!itemGrid.has(categoryKey)) itemGrid.set(categoryKey, new Map());
    const items = itemGrid.get(categoryKey)!;
    const itemKey = t.mapping_id ?? t.raw_text;
    if (!items.has(itemKey)) {
      items.set(itemKey, { label: t.comment ?? t.raw_text, months: new Array(12).fill(0) });
    }
    items.get(itemKey)!.months[monthIndex] += amount;
  }

  const rows: YearTableCategory[] = Array.from(categoryGrid.entries())
    .map(([key, months]) => {
      // To forskellige mapping-regler kan pege på samme tekst (fx hvis en
      // regel er oprettet to gange for samme post) - de skal vises som én
      // række, ikke splittes ud efter internt regel-id.
      const mergedByLabel = new Map<string, number[]>();
      for (const { label, months: itemMonths } of (
        itemGrid.get(key) ?? new Map<string, { label: string; months: number[] }>()
      ).values()) {
        const existing = mergedByLabel.get(label);
        if (existing) {
          itemMonths.forEach((v, i) => {
            existing[i] += v;
          });
        } else {
          mergedByLabel.set(label, [...itemMonths]);
        }
      }

      const items = Array.from(mergedByLabel.entries())
        .map(([label, itemMonths]) => ({
          key: label,
          label,
          months: itemMonths,
          total: itemMonths.reduce((sum, v) => sum + v, 0),
        }))
        .sort((a, b) => b.total - a.total);

      return {
        key,
        name:
          key === "none" ? "Ukategoriseret" : categoryMap.get(key)?.name ?? "Ukendt",
        months,
        total: months.reduce((sum, v) => sum + v, 0),
        items,
      };
    })
    .sort((a, b) => b.total - a.total);

  const monthTotals = new Array(12).fill(0);
  for (const row of rows) {
    row.months.forEach((value, i) => {
      monthTotals[i] += value;
    });
  }
  const grandTotal = monthTotals.reduce((sum, v) => sum + v, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Årsoversigt</h1>
        <YearSelector year={year} />
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Udgifter pr. kategori og måned for {year} (ekskl. ekstraordinære
        poster). Klik på en kategori for at se de enkelte poster.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-400">
          Ingen posteringer for {year}.
        </p>
      ) : (
        <YearTable rows={rows} monthTotals={monthTotals} grandTotal={grandTotal} />
      )}
    </div>
  );
}
