import { describe, expect, it } from "vitest";
import {
  computeBudgetActuals,
  type ActualLine,
  type ActualTransaction,
} from "./computeBudgetActuals";

let counter = 0;
function tx(overrides: Partial<ActualTransaction>): ActualTransaction {
  counter += 1;
  return {
    id: `tx-${counter}`,
    date: "2027-01-10",
    amount: -100,
    mapping_id: null,
    category_id: null,
    is_extraordinary: false,
    comment: null,
    raw_text: "Tekst",
    ...overrides,
  };
}

function line(overrides: Partial<ActualLine>): ActualLine {
  return {
    id: "l1",
    kind: "expense",
    category_id: null,
    mapping_ids: [],
    include_category: false,
    ...overrides,
  };
}

describe("computeBudgetActuals", () => {
  it("lægger posteringer på den post, hvis regel de matcher", () => {
    const result = computeBudgetActuals(
      [line({ id: "mad", mapping_ids: ["netto", "rema"] })],
      [
        tx({ date: "2027-01-05", amount: -300, mapping_id: "netto" }),
        tx({ date: "2027-01-20", amount: -200, mapping_id: "rema" }),
        tx({ date: "2027-02-03", amount: -150, mapping_id: "netto" }),
      ],
      [],
      2027,
    );

    expect(result.lineActuals.get("mad")!.slice(0, 2)).toEqual([500, 150]);
    expect(result.unbudgetedExpense[0]).toBe(0);
  });

  it("regner en refusion som mindre forbrug på en udgiftspost", () => {
    const result = computeBudgetActuals(
      [line({ id: "mad", mapping_ids: ["netto"] })],
      [
        tx({ amount: -300, mapping_id: "netto" }),
        tx({ amount: 50, mapping_id: "netto" }),
      ],
      [],
      2027,
    );
    expect(result.lineActuals.get("mad")![0]).toBe(250);
  });

  it("bruger kategorien som opsamling, men regler går forud", () => {
    const result = computeBudgetActuals(
      [
        line({ id: "bil", mapping_ids: ["benzin"] }),
        line({ id: "transport", category_id: "transport", include_category: true }),
      ],
      [
        tx({ amount: -400, mapping_id: "benzin", category_id: "transport" }),
        tx({ amount: -60, mapping_id: null, category_id: "transport" }),
      ],
      [],
      2027,
    );
    expect(result.lineActuals.get("bil")![0]).toBe(400);
    expect(result.lineActuals.get("transport")![0]).toBe(60);
  });

  it("samler posteringer uden post som ikke budgetteret, grupperet pr. regel", () => {
    const result = computeBudgetActuals(
      [],
      [
        tx({ amount: -100, mapping_id: "kiosk" }),
        tx({ amount: -50, mapping_id: "kiosk", date: "2027-03-01" }),
        tx({ amount: 1000, raw_text: "Gave" }),
      ],
      [{ id: "kiosk", label: "Kiosk" }],
      2027,
    );

    expect(result.unbudgetedExpense[0]).toBe(100);
    expect(result.unbudgetedIncome[0]).toBe(1000);
    const kiosk = result.unbudgetedGroups.find((g) => g.mappingId === "kiosk")!;
    expect(kiosk.label).toBe("Kiosk");
    expect(kiosk.total).toBe(150);
    expect(kiosk.count).toBe(2);
    expect(result.expenseTotals[0]).toBe(100);
    expect(result.incomeTotals[0]).toBe(1000);
  });

  it("holder ekstraordinære posteringer uden for budgetposterne", () => {
    const result = computeBudgetActuals(
      [line({ id: "bil", mapping_ids: ["vaerksted"] })],
      [tx({ amount: -9000, mapping_id: "vaerksted", is_extraordinary: true })],
      [],
      2027,
    );
    expect(result.lineActuals.get("bil")![0]).toBe(0);
    expect(result.extraordinaryExpense[0]).toBe(9000);
    expect(result.expenseTotals[0]).toBe(9000);
  });

  it("markerer kun måneder med posteringer, og ignorerer andre år", () => {
    const result = computeBudgetActuals(
      [],
      [tx({ date: "2027-02-01" }), tx({ date: "2026-12-31" })],
      [],
      2027,
    );
    expect(result.monthsWithData.slice(0, 3)).toEqual([false, true, false]);
    expect(result.unbudgetedExpense[11]).toBe(0);
  });
});
