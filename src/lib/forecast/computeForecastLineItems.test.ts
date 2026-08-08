import { describe, expect, it } from "vitest";
import { computeForecastLineItems } from "./computeForecastLineItems";
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

function makeMapping(overrides: Partial<TextMappingRow>): TextMappingRow {
  return {
    id: "m1",
    match_pattern: "Test",
    match_type: "prefix",
    comment: null,
    category_id: null,
    min_amount: null,
    max_amount: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeForecastLineItems", () => {
  it("viser hver mapping-regel som sin egen linje, ikke summeret sammen", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -109, mapping_id: "spotify" }),
      makeTx({ date: "2026-06-01", amount: -109, mapping_id: "spotify" }),
      makeTx({ date: "2026-05-01", amount: -700, mapping_id: "forsikring" }),
      makeTx({ date: "2026-06-01", amount: -700, mapping_id: "forsikring" }),
    ];
    const mappings = [
      makeMapping({ id: "spotify", comment: "Spotify" }),
      makeMapping({ id: "forsikring", comment: "Bilforsikring" }),
    ];

    const sheet = computeForecastLineItems(transactions, mappings, "2026-06", 1);

    expect(sheet.expenseItems).toHaveLength(2);
    const labels = sheet.expenseItems.map((i) => i.label).sort();
    expect(labels).toEqual(["Bilforsikring", "Spotify"]);
  });

  it("bruger kommentaren som label, eller mønsteret hvis kommentar mangler", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -100, mapping_id: "m1" }),
      makeTx({ date: "2026-06-01", amount: -100, mapping_id: "m1" }),
    ];
    const mappings = [makeMapping({ id: "m1", comment: null, match_pattern: "Netflix" })];

    const sheet = computeForecastLineItems(transactions, mappings, "2026-06", 1);

    expect(sheet.expenseItems[0].label).toBe("Netflix");
  });

  it("adskiller indbetalinger og udgifter i hver sin liste", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-06-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-05-01", amount: -15000, mapping_id: "rent" }),
      makeTx({ date: "2026-06-01", amount: -15000, mapping_id: "rent" }),
    ];
    const mappings = [
      makeMapping({ id: "income", comment: "Løn" }),
      makeMapping({ id: "rent", comment: "Husleje" }),
    ];

    const sheet = computeForecastLineItems(transactions, mappings, "2026-06", 1);

    expect(sheet.incomeItems).toHaveLength(1);
    expect(sheet.incomeItems[0].label).toBe("Løn");
    expect(sheet.expenseItems).toHaveLength(1);
    expect(sheet.expenseItems[0].label).toBe("Husleje");
  });

  it("beregner måneds-totaler og nettoresultat på tværs af alle poster", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-06-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-05-01", amount: -15000, mapping_id: "rent" }),
      makeTx({ date: "2026-06-01", amount: -15000, mapping_id: "rent" }),
    ];
    const mappings = [
      makeMapping({ id: "income", comment: "Løn" }),
      makeMapping({ id: "rent", comment: "Husleje" }),
    ];

    const sheet = computeForecastLineItems(transactions, mappings, "2026-06", 1);

    expect(sheet.incomeTotals).toEqual([20000]);
    expect(sheet.expenseTotals).toEqual([15000]);
    expect(sheet.netTotals).toEqual([5000]);
  });

  it("medregner øvrige (ikke-genkendte) udgifter som en del af udgiftstotalen", () => {
    const transactions = [
      makeTx({ date: "2026-05-15", amount: -200, mapping_id: null }),
      makeTx({ date: "2026-06-15", amount: -400, mapping_id: null }),
    ];

    const sheet = computeForecastLineItems(transactions, [], "2026-07", 1);

    expect(sheet.otherExpenseAverage).toBe(300);
    expect(sheet.expenseTotals).toEqual([300]);
  });

  it("udelader en regel der er manuelt markeret som afsluttet", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -3200, mapping_id: "realkredit" }),
      makeTx({ date: "2026-06-01", amount: -3200, mapping_id: "realkredit" }),
    ];
    const mappings = [makeMapping({ id: "realkredit", comment: "Realkredit" })];

    const sheet = computeForecastLineItems(
      transactions,
      mappings,
      "2026-06",
      3,
      new Set(["realkredit"]),
    );

    expect(sheet.expenseItems).toHaveLength(0);
  });

  it("returnerer månedsnøglerne i kronologisk rækkefølge", () => {
    const sheet = computeForecastLineItems([], [], "2026-06", 3);
    expect(sheet.monthKeys).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
});
