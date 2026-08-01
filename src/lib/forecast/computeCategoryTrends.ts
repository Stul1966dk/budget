import type { Category, TransactionRow } from "@/lib/types/db";
import { extractMonthKey } from "@/lib/month";

export type TrendDirection = "increasing" | "decreasing" | "stable";

export type CategoryTrend = {
  categoryId: string;
  categoryName: string;
  monthlyTotals: { monthKey: string; total: number }[];
  percentChange: number;
  direction: TrendDirection;
};

/**
 * Sammenligner gennemsnittet af den første og anden halvdel af de seneste
 * `monthsBack` måneder pr. kategori, for at opdage kategorier der stille og
 * roligt vokser eller falder. Kræver mindst 4 måneders data pr. kategori for
 * at vurdere en trend - ellers markeres den som "stable".
 */
export function computeCategoryTrends(
  transactions: TransactionRow[],
  categories: Category[],
  monthsBack = 6,
): CategoryTrend[] {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const ordinary = transactions.filter(
    (t) => !t.is_extraordinary && t.amount < 0 && t.category_id !== null,
  );

  const byCategory = new Map<string, Map<string, number>>();
  for (const t of ordinary) {
    const categoryId = t.category_id!;
    const monthKey = extractMonthKey(t.date);
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, new Map());
    const monthMap = byCategory.get(categoryId)!;
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Math.abs(t.amount));
  }

  const recentMonths = Array.from(new Set(ordinary.map((t) => extractMonthKey(t.date))))
    .sort()
    .slice(-monthsBack);

  const trends: CategoryTrend[] = [];

  for (const [categoryId, monthMap] of byCategory) {
    const monthlyTotals = recentMonths.map((monthKey) => ({
      monthKey,
      total: monthMap.get(monthKey) ?? 0,
    }));

    if (recentMonths.length < 4) {
      trends.push({
        categoryId,
        categoryName: categoryNames.get(categoryId) ?? "Ukendt",
        monthlyTotals,
        percentChange: 0,
        direction: "stable",
      });
      continue;
    }

    const mid = Math.floor(monthlyTotals.length / 2);
    const firstHalf = monthlyTotals.slice(0, mid);
    const secondHalf = monthlyTotals.slice(mid);
    const firstAvg = firstHalf.reduce((sum, m) => sum + m.total, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.total, 0) / secondHalf.length;

    const percentChange = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    const direction: TrendDirection =
      percentChange > 10 ? "increasing" : percentChange < -10 ? "decreasing" : "stable";

    trends.push({
      categoryId,
      categoryName: categoryNames.get(categoryId) ?? "Ukendt",
      monthlyTotals,
      percentChange: Math.round(percentChange * 10) / 10,
      direction,
    });
  }

  return trends.sort((a, b) => b.percentChange - a.percentChange);
}
