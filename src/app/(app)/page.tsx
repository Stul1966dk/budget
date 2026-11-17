import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { AlertRow, Category, TextMappingRow, TransactionRow } from "@/lib/types/db";
import { computeCurrentBalance } from "@/lib/forecast/computeCurrentBalance";
import { computeMonthlyBalances } from "@/lib/forecast/computeMonthlyBalances";
import { computeMonthlyLowestBalances } from "@/lib/forecast/computeMonthlyLowestBalances";
import { formatCurrency } from "@/lib/format";
import { AlertsPanel } from "./AlertsPanel";
import { YearSelector } from "./aar/YearSelector";
import { YearTable, type YearTableCategory } from "./aar/YearTable";

type YearTransaction = Pick<
  TransactionRow,
  | "id"
  | "date"
  | "amount"
  | "category_id"
  | "is_extraordinary"
  | "raw_text"
  | "comment"
  | "mapping_id"
  | "balance"
  | "import_seq"
>;
type YearMappingRule = Pick<
  TextMappingRow,
  "id" | "comment" | "match_pattern" | "display_mode"
>;

export default async function AarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Det der ikke afhænger af det valgte år, sættes i gang med det samme, så
  // det hentes samtidig med årsposteringerne i stedet for før eller efter.
  const independent = Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("text_mappings").select("id, comment, match_pattern, display_mode"),
    supabase
      .from("alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false }),
    // Kun den seneste kendte saldo - ikke alle posteringer fra alle år.
    supabase
      .from("transactions")
      .select("date, balance, import_seq")
      .not("balance", "is", null)
      .order("date", { ascending: false })
      .order("import_seq", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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

  // Én forespørgsel for hele året, inkl. ekstraordinære poster: saldoen pr.
  // måned skal have dem med, mens kategoritabellen sorterer dem fra nedenfor.
  const [
    { data: yearData },
    [
      { data: categoriesData },
      { data: mappingsData },
      { data: alertsData },
      { data: latestBalanceData },
    ],
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("transactions")
        .select(
          "id, date, amount, category_id, is_extraordinary, raw_text, comment, mapping_id, balance, import_seq",
        )
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("id")
        .range(from, to),
    ),
    independent,
  ]);

  const yearRows = (yearData ?? []) as YearTransaction[];
  const categories = (categoriesData ?? []) as Category[];
  const transactions = yearRows.filter((t) => !t.is_extraordinary);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const ruleMap = new Map(
    ((mappingsData ?? []) as YearMappingRule[]).map((m) => [m.id, m]),
  );
  const currentBalance = computeCurrentBalance(latestBalanceData ? [latestBalanceData] : []);
  const monthlyBalances = computeMonthlyBalances(yearRows, year);
  const monthlyLowestBalances = computeMonthlyLowestBalances(yearRows, year);
  const alerts = (alertsData ?? []) as AlertRow[];

  const monthIncome: number[] = new Array(12).fill(0);
  for (const t of transactions) {
    if (t.amount > 0) monthIncome[Number(t.date.slice(5, 7)) - 1] += t.amount;
  }

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
    if (t.amount >= 0) continue; // kategorirækkerne viser kun udgifter
    const monthIndex = Number(t.date.slice(5, 7)) - 1;
    const categoryKey = t.category_id ?? "none";
    const amount = Math.abs(t.amount);

    bucket(categoryGrid, categoryKey)[monthIndex] += amount;

    if (!itemGrid.has(categoryKey)) itemGrid.set(categoryKey, new Map());
    const items = itemGrid.get(categoryKey)!;

    // Grupperingen styres af reglens "Visning" (se Regler-siden), ikke af
    // hardcodet logik her: "Saml til én post" grupperer efter regel-id, så
    // alle matches vises som én linje. "Vis hver for sig" viser altid hver
    // postering på sin egen linje (nøglen er posteringens eget id) - uanset
    // om banken tilfældigvis bruger identisk rå tekst for flere posteringer
    // (fx et fast medlemskab uden løbenummer). En manuel kommentar der
    // afviger fra reglens, vinder altid og adskiller den enkelte postering,
    // uanset reglens Visning-indstilling; flere posteringer man selv har
    // givet samme navn, vises samlet.
    const rule = t.mapping_id ? ruleMap.get(t.mapping_id) : undefined;
    const isManualOverride =
      rule !== undefined && t.comment !== null && t.comment !== rule.comment;
    const useGroupedKey = rule !== undefined && rule.display_mode === "grouped" && !isManualOverride;
    const useIndividualKey =
      !useGroupedKey && rule !== undefined && rule.display_mode === "individual" && !isManualOverride;

    const itemKey = useGroupedKey
      ? rule.id
      : useIndividualKey
        ? t.id
        : t.comment ?? t.raw_text;
    const itemLabel = useGroupedKey
      ? rule.comment ?? rule.match_pattern
      : t.comment ?? t.raw_text;

    if (!items.has(itemKey)) {
      items.set(itemKey, { label: itemLabel, months: new Array(12).fill(0) });
    }
    items.get(itemKey)!.months[monthIndex] += amount;
  }

  const rows: YearTableCategory[] = Array.from(categoryGrid.entries())
    .map(([key, months]) => {
      const items = Array.from((itemGrid.get(key) ?? new Map()).entries())
        .map(([itemKey, item]) => ({
          key: itemKey,
          label: item.label,
          months: item.months,
          total: item.months.reduce((sum: number, v: number) => sum + v, 0),
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
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <AlertsPanel alerts={alerts} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Årsoversigt</h1>
        <YearSelector year={year} />
      </div>
      <p className="mt-1 text-sm text-white/80">
        Udgifter pr. kategori og måned for {year}, med indtægter, resultat og
        saldo nederst (ekskl. ekstraordinære poster). Klik på en kategori for
        at se de enkelte poster.
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

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/70">
          Ingen posteringer for {year}.
        </p>
      ) : (
        <YearTable
          rows={rows}
          monthTotals={monthTotals}
          grandTotal={grandTotal}
          monthIncome={monthIncome}
          monthlyBalances={monthlyBalances}
          monthlyLowestBalances={monthlyLowestBalances}
        />
      )}
    </div>
  );
}
