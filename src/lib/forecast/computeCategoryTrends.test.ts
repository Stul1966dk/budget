import { describe, expect, it } from "vitest";
import { computeCategoryTrends } from "./computeCategoryTrends";
import type { Category, TransactionRow } from "@/lib/types/db";

let counter = 0;
function makeTx(overrides: Partial<TransactionRow>): TransactionRow {
  counter += 1;
  return {
    id: `tx-${counter}`,
    date: "2026-01-01",
    raw_text: "Test",
    amount: -100,
    balance: null,
    status: null,
    reconciled: null,
    row_hash: `hash-${counter}`,
    comment: null,
    category_id: "c1",
    is_extraordinary: false,
    mapping_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const categories: Category[] = [{ id: "c1", name: "Transport", color: null, sort_order: 1 }];

describe("computeCategoryTrends", () => {
  it("markerer en kategori som stigende når anden halvdel er markant højere", () => {
    const transactions = [
      makeTx({ date: "2026-01-01", amount: -100 }),
      makeTx({ date: "2026-02-01", amount: -100 }),
      makeTx({ date: "2026-03-01", amount: -300 }),
      makeTx({ date: "2026-04-01", amount: -300 }),
    ];

    const [trend] = computeCategoryTrends(transactions, categories, 4);

    expect(trend.direction).toBe("increasing");
    expect(trend.percentChange).toBeGreaterThan(10);
  });

  it("markerer en kategori som stabil ved uændret forbrug", () => {
    const transactions = [
      makeTx({ date: "2026-01-01", amount: -100 }),
      makeTx({ date: "2026-02-01", amount: -105 }),
      makeTx({ date: "2026-03-01", amount: -100 }),
      makeTx({ date: "2026-04-01", amount: -102 }),
    ];

    const [trend] = computeCategoryTrends(transactions, categories, 4);

    expect(trend.direction).toBe("stable");
  });

  it("markerer som stabil når der er under 4 måneders data", () => {
    const transactions = [
      makeTx({ date: "2026-01-01", amount: -100 }),
      makeTx({ date: "2026-02-01", amount: -500 }),
    ];

    const [trend] = computeCategoryTrends(transactions, categories, 6);

    expect(trend.direction).toBe("stable");
    expect(trend.percentChange).toBe(0);
  });

  it("udelader ekstraordinære posteringer og posteringer uden kategori", () => {
    const transactions = [
      makeTx({ date: "2026-01-01", amount: -100 }),
      makeTx({ date: "2026-02-01", amount: -100 }),
      makeTx({ date: "2026-03-01", amount: -100 }),
      makeTx({ date: "2026-04-01", amount: -100 }),
      makeTx({ date: "2026-04-15", amount: -50000, is_extraordinary: true }),
      makeTx({ date: "2026-04-20", amount: -999, category_id: null }),
    ];

    const [trend] = computeCategoryTrends(transactions, categories, 4);

    expect(trend.monthlyTotals.find((m) => m.monthKey === "2026-04")?.total).toBe(100);
  });
});
