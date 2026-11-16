import { describe, expect, it } from "vitest";
import { buildBudgetFromForecast } from "./buildBudgetFromForecast";
import { computeBudgetTotals } from "./computeBudgetTotals";
import type { TextMappingRow, TransactionRow } from "@/lib/types/db";

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
    import_seq: counter,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMapping(
  overrides: Partial<TextMappingRow>,
): Pick<TextMappingRow, "id" | "comment" | "match_pattern" | "category_id" | "active"> {
  return {
    id: "m1",
    comment: null,
    match_pattern: "Test",
    category_id: null,
    active: true,
    ...overrides,
  };
}

const monthly = (mappingId: string, amount: number, months: string[]) =>
  months.map((mk) => makeTx({ date: `${mk}-01`, amount, mapping_id: mappingId }));

describe("buildBudgetFromForecast", () => {
  it("laver én linje pr. mapping-regel med 12 månedsbeløb for året", () => {
    const transactions = [
      ...monthly("rent", -8000, ["2026-08", "2026-09", "2026-10"]),
      ...monthly("salary", 30000, ["2026-08", "2026-09", "2026-10"]),
    ];
    const mappings = [
      makeMapping({ id: "rent", comment: "Husleje", category_id: "bolig" }),
      makeMapping({ id: "salary", comment: "Løn" }),
    ];

    const draft = buildBudgetFromForecast(transactions, mappings, null, 2027);

    const rent = draft.lines.find((l) => l.label === "Husleje")!;
    expect(rent.kind).toBe("expense");
    expect(rent.mappingId).toBe("rent");
    expect(rent.categoryId).toBe("bolig");
    expect(rent.amounts).toEqual(Array(12).fill(8000));

    const salary = draft.lines.find((l) => l.label === "Løn")!;
    expect(salary.kind).toBe("income");
    expect(salary.amounts).toEqual(Array(12).fill(30000));
  });

  it("udelader regler der er slået fra", () => {
    const transactions = monthly("old", -100, ["2026-08", "2026-09", "2026-10"]);
    const mappings = [makeMapping({ id: "old", comment: "Opsagt", active: false })];

    const draft = buildBudgetFromForecast(transactions, mappings, null, 2027);

    expect(draft.lines.find((l) => l.label === "Opsagt")).toBeUndefined();
  });

  it("bruger den manuelle indbetaling som én indtægtslinje", () => {
    const transactions = [
      ...monthly("salary", 30000, ["2026-08", "2026-09", "2026-10"]),
    ];
    const mappings = [makeMapping({ id: "salary", comment: "Løn" })];

    const draft = buildBudgetFromForecast(transactions, mappings, 25000, 2027);

    const income = draft.lines.filter((l) => l.kind === "income");
    expect(income).toHaveLength(1);
    expect(income[0].label).toBe("Indbetalinger");
    expect(income[0].amounts).toEqual(Array(12).fill(25000));
  });

  it("fylder måneder før seneste postering ud med samme kalendermåned fra prognosen", () => {
    const transactions = monthly("rent", -8000, ["2026-08", "2026-09", "2026-10"]);
    const mappings = [makeMapping({ id: "rent", comment: "Husleje" })];

    const draft = buildBudgetFromForecast(transactions, mappings, null, 2026);

    expect(draft.lines[0].amounts).toEqual(Array(12).fill(8000));
  });

  it("regner startsaldo som nuværende saldo plus forventet netto frem til årets start", () => {
    const transactions = [
      ...monthly("rent", -8000, ["2026-08", "2026-09"]),
      makeTx({ date: "2026-10-01", amount: -8000, mapping_id: "rent", balance: 10000 }),
      ...monthly("salary", 10000, ["2026-08", "2026-09", "2026-10"]),
    ];
    const mappings = [
      makeMapping({ id: "rent", comment: "Husleje" }),
      makeMapping({ id: "salary", comment: "Løn" }),
    ];

    const draft = buildBudgetFromForecast(transactions, mappings, null, 2027);

    // Saldo 10.000 + (10.000 - 8.000) for november og december.
    expect(draft.startBalance).toBe(14000);
  });

  it("giver ingen startsaldo når saldoen er ukendt", () => {
    const transactions = monthly("rent", -8000, ["2026-08", "2026-09", "2026-10"]);
    const draft = buildBudgetFromForecast(
      transactions,
      [makeMapping({ id: "rent" })],
      null,
      2027,
    );
    expect(draft.startBalance).toBeNull();
  });
});

describe("computeBudgetTotals", () => {
  it("summerer pr. måned og lægger nettoresultatet oveni startsaldoen", () => {
    const totals = computeBudgetTotals(
      [
        { kind: "income", amounts: Array(12).fill(1000) },
        { kind: "expense", amounts: [300, ...Array(11).fill(0)] },
        { kind: "expense", amounts: Array(12).fill(500) },
      ],
      100,
    );

    expect(totals.incomeTotals[0]).toBe(1000);
    expect(totals.expenseTotals[0]).toBe(800);
    expect(totals.netTotals[0]).toBe(200);
    expect(totals.balances[0]).toBe(300);
    expect(totals.balances[1]).toBe(800);
    expect(totals.balances[11]).toBe(100 + 200 + 11 * 500);
  });
});
