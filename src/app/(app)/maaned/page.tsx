import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import {
  extractMonthKey,
  getCurrentMonthKey,
  monthKeyToDateRange,
} from "@/lib/month";
import type { Category, TransactionRow } from "@/lib/types/db";
import { MonthSelector } from "../MonthSelector";
import { TransactionList } from "../TransactionList";

export default async function PosteringerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const filterMode: "alle" | "umatchede" | "ekstraordinaere" =
    params.filter === "umatchede"
      ? "umatchede"
      : params.filter === "ekstraordinaere"
        ? "ekstraordinaere"
        : "alle";

  // Det der ikke afhænger af den valgte måned, sættes i gang med det samme,
  // så det hentes samtidig med månedens posteringer.
  const independent = Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    fetchAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("date")
        .order("date", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("is_extraordinary", true),
    filterMode === "ekstraordinaere"
      ? supabase
          .from("transactions")
          .select("*")
          .eq("is_extraordinary", true)
          .order("date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

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
    { data: transactionsData },
    [
      { data: categoriesData },
      { data: monthsData },
      { count: extraordinaryCount },
      { data: extraordinaryAllTimeData },
    ],
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("import_seq", { ascending: true }),
    independent,
  ]);

  const categories = (categoriesData ?? []) as Category[];
  const allTransactions = (transactionsData ?? []) as TransactionRow[];

  const availableMonths = Array.from(
    new Set((monthsData ?? []).map((r) => extractMonthKey(r.date))),
  );
  if (!availableMonths.includes(monthKey)) availableMonths.push(monthKey);
  availableMonths.sort().reverse();

  const extraordinaryAllTime = (extraordinaryAllTimeData ?? []) as TransactionRow[];

  const visibleTransactions =
    filterMode === "ekstraordinaere"
      ? extraordinaryAllTime
      : filterMode === "umatchede"
        ? allTransactions.filter((t) => t.category_id === null)
        : allTransactions;

  const counts = {
    alle: allTransactions.length,
    umatchede: allTransactions.filter((t) => t.category_id === null).length,
    ekstraordinaere: extraordinaryCount ?? 0,
  };

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-white">Posteringer</h1>
      <p className="mt-1 text-sm text-white/80">
        Klik på en postering for at give den en kommentar, en kategori eller
        lave en regel. Tal og overblik finder du under År og Budget.
      </p>

      <div className="mt-4">
        <MonthSelector currentMonth={monthKey} availableMonths={availableMonths} />
      </div>

      <TransactionList
        transactions={visibleTransactions}
        categories={categories}
        filterMode={filterMode}
        monthKey={monthKey}
        counts={counts}
      />
    </div>
  );
}
