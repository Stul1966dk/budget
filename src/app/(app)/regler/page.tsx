import { createClient } from "@/lib/supabase/server";
import type { Category, TextMappingRow } from "@/lib/types/db";
import { RuleList } from "./RuleList";

export default async function ReglerPage() {
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

  const rules = (rulesData ?? []) as TextMappingRow[];
  const categories = (categoriesData ?? []) as Category[];

  const matchCounts: Record<string, number> = {};
  for (const row of mappingIdsData ?? []) {
    if (!row.mapping_id) continue;
    matchCounts[row.mapping_id] = (matchCounts[row.mapping_id] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Regler</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mapping-regler udfylder automatisk kommentar og kategori på nye
        posteringer ved import, ud fra deres rå tekst fra banken.
      </p>

      <RuleList rules={rules} categories={categories} matchCounts={matchCounts} />
    </div>
  );
}
