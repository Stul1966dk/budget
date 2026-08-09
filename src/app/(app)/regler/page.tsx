import { createClient } from "@/lib/supabase/server";
import type { Category, TextMappingRow } from "@/lib/types/db";
import { RuleList } from "./RuleList";
import { CategoryFilter } from "./CategoryFilter";

export default async function ReglerPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string }>;
}) {
  const params = await searchParams;
  const filter =
    params.filter === "alle" || params.filter === "afsluttede"
      ? params.filter
      : "aktive";
  const categoryFilter = params.category ?? "";

  const supabase = await createClient();

  const [{ data: rulesData }, { data: categoriesData }, { data: mappingIdsData }] =
    await Promise.all([
      supabase
        .from("text_mappings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("transactions")
        .select("mapping_id, amount")
        .not("mapping_id", "is", null),
    ]);

  const allRules = (rulesData ?? []) as TextMappingRow[];
  const categories = (categoriesData ?? []) as Category[];
  const activeCount = allRules.filter((r) => r.active).length;
  const inactiveCount = allRules.length - activeCount;
  const statusFilteredRules =
    filter === "alle"
      ? allRules
      : filter === "afsluttede"
        ? allRules.filter((r) => !r.active)
        : allRules.filter((r) => r.active);
  const rules = !categoryFilter
    ? statusFilteredRules
    : categoryFilter === "none"
      ? statusFilteredRules.filter((r) => r.category_id === null)
      : statusFilteredRules.filter((r) => r.category_id === categoryFilter);

  const matchCounts: Record<string, number> = {};
  const matchAmountRanges: Record<string, { min: number; max: number }> = {};
  for (const row of mappingIdsData ?? []) {
    if (!row.mapping_id) continue;
    matchCounts[row.mapping_id] = (matchCounts[row.mapping_id] ?? 0) + 1;
    const amount = Math.abs(row.amount);
    const existing = matchAmountRanges[row.mapping_id];
    matchAmountRanges[row.mapping_id] = existing
      ? { min: Math.min(existing.min, amount), max: Math.max(existing.max, amount) }
      : { min: amount, max: amount };
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">Regler</h1>
      <p className="mt-1 text-sm text-stone-500">
        Mapping-regler udfylder automatisk kommentar og kategori på nye
        posteringer ved import, ud fra deres rå tekst fra banken.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
          <a
            href={`?${categoryFilter ? `category=${categoryFilter}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === "aktive"
                ? "bg-forest-900 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Aktive ({activeCount})
          </a>
          <a
            href={`?filter=afsluttede${categoryFilter ? `&category=${categoryFilter}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === "afsluttede"
                ? "bg-forest-900 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Afsluttede ({inactiveCount})
          </a>
          <a
            href={`?filter=alle${categoryFilter ? `&category=${categoryFilter}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === "alle"
                ? "bg-forest-900 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Alle ({allRules.length})
          </a>
        </div>
        <CategoryFilter categories={categories} />
      </div>

      <RuleList
        rules={rules}
        categories={categories}
        matchCounts={matchCounts}
        matchAmountRanges={matchAmountRanges}
      />
    </div>
  );
}
