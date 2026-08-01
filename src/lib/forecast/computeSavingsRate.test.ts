import { describe, expect, it } from "vitest";
import { computeSavingsRate } from "./computeSavingsRate";
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
    category_id: null,
    is_extraordinary: false,
    mapping_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const categories: Category[] = [
  { id: "c-savings", name: "Pension/Opsparing", color: null, sort_order: 1 },
  { id: "c-other", name: "Mad", color: null, sort_order: 2 },
];

describe("computeSavingsRate", () => {
  it("beregner indtægt, udgifter, resultat og opsparing pr. måned", () => {
    const transactions = [
      makeTx({ date: "2026-01-05", amount: 30000 }),
      makeTx({ date: "2026-01-10", amount: -20000 }),
      makeTx({ date: "2026-01-15", amount: -2000, category_id: "c-savings" }),
    ];

    const result = computeSavingsRate(transactions, categories);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      monthKey: "2026-01",
      income: 30000,
      expenses: -22000,
      result: 8000,
      savings: 2000,
    });
  });

  it("udelader ekstraordinære posteringer", () => {
    const transactions = [
      makeTx({ date: "2026-01-05", amount: 30000 }),
      makeTx({ date: "2026-01-10", amount: -200000, is_extraordinary: true }),
    ];

    const result = computeSavingsRate(transactions, categories);

    expect(result[0].expenses).toBe(0);
    expect(result[0].result).toBe(30000);
  });

  it("begrænser til de seneste `monthsBack` måneder", () => {
    const transactions = [
      makeTx({ date: "2025-01-05", amount: 100 }),
      makeTx({ date: "2025-06-05", amount: 100 }),
      makeTx({ date: "2026-01-05", amount: 100 }),
    ];

    const result = computeSavingsRate(transactions, categories, 2);

    expect(result.map((r) => r.monthKey)).toEqual(["2025-06", "2026-01"]);
  });
});
