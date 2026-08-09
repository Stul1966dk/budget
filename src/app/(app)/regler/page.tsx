import { createClient } from "@/lib/supabase/server";
import type { Category, TextMappingRow } from "@/lib/types/db";
import { RuleList } from "./RuleList";

export default async function ReglerPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter =
    params.filter === "alle" || params.filter === "afsluttede"
      ? params.filter
      : "aktive";

  const supabase = await createClient();

  const [{ data: rulesData }, { data: categoriesData }, { data: mappingIdsData }] =
    await Promise.all([
      supabase
        .from("text_mappings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("transactions").select("mapping_id").not("mapping_id", "is", null),
    ]);

  const allRules = (rulesData ?? []) as TextMappingRow[];
  const categories = (categoriesData ?? []) as Category[];
  const activeCount = allRules.filter((r) => r.active).length;
  const inactiveCount = allRules.length - activeCount;
  const rules =
    filter === "alle"
      ? allRules
      : filter === "afsluttede"
        ? allRules.filter((r) => !r.active)
        : allRules.filter((r) => r.active);

  const matchCounts: Record<string, number> = {};
  for (const row of mappingIdsData ?? []) {
    if (!row.mapping_id) continue;
    matchCounts[row.mapping_id] = (matchCounts[row.mapping_id] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">Regler</h1>
      <p className="mt-1 text-sm text-stone-500">
        Mapping-regler udfylder automatisk kommentar og kategori på nye
        posteringer ved import, ud fra deres rå tekst fra banken.
      </p>

      <div className="mt-4 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
        <a
          href="?"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            filter === "aktive"
              ? "bg-forest-900 text-white"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          Aktive ({activeCount})
        </a>
        <a
          href="?filter=afsluttede"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            filter === "afsluttede"
              ? "bg-forest-900 text-white"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          Afsluttede ({inactiveCount})
        </a>
        <a
          href="?filter=alle"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            filter === "alle"
              ? "bg-forest-900 text-white"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          Alle ({allRules.length})
        </a>
      </div>

      <RuleList rules={rules} categories={categories} matchCounts={matchCounts} />
    </div>
  );
}
