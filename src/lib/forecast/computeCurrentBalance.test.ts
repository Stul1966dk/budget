import { describe, expect, it } from "vitest";
import { computeCurrentBalance } from "./computeCurrentBalance";
import type { TransactionRow } from "@/lib/types/db";

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

describe("computeCurrentBalance", () => {
  it("returnerer saldoen fra den seneste postering", () => {
    const transactions = [
      makeTx({ date: "2026-01-05", balance: 1000 }),
      makeTx({ date: "2026-02-10", balance: 2500 }),
    ];

    expect(computeCurrentBalance(transactions)).toBe(2500);
  });

  it("er uafhængig af rækkefølgen posteringerne hentes i", () => {
    const transactions = [
      makeTx({ date: "2026-02-10", balance: 2500 }),
      makeTx({ date: "2026-01-05", balance: 1000 }),
    ];

    expect(computeCurrentBalance(transactions)).toBe(2500);
  });

  it("springer posteringer uden kendt saldo over", () => {
    const transactions = [
      makeTx({ date: "2026-01-05", balance: 1000 }),
      makeTx({ date: "2026-02-10", balance: null }),
    ];

    expect(computeCurrentBalance(transactions)).toBe(1000);
  });

  it("returnerer null uden posteringer med saldo", () => {
    expect(computeCurrentBalance([])).toBeNull();
    expect(computeCurrentBalance([makeTx({ balance: null })])).toBeNull();
  });

  it("bruger import_seq til at afgøre den seneste postering, når flere deler samme dato", () => {
    // Danske Bank-CSV'en har kun dato, ikke klokkeslæt - flere posteringer
    // samme dag kan derfor kun skelnes ved deres rækkefølge i filen.
    const transactions = [
      makeTx({ date: "2026-08-03", balance: 5000, import_seq: 1 }),
      makeTx({ date: "2026-08-03", balance: 3000, import_seq: 2 }),
      makeTx({ date: "2026-08-03", balance: 14913.25, import_seq: 3 }),
      makeTx({ date: "2026-08-03", balance: -1169.75, import_seq: 4 }),
    ];

    expect(computeCurrentBalance(transactions)).toBe(-1169.75);
  });

  it("er uafhængig af hentnings-rækkefølgen, selv med flere posteringer samme dag", () => {
    const transactions = [
      makeTx({ date: "2026-08-03", balance: -1169.75, import_seq: 4 }),
      makeTx({ date: "2026-08-03", balance: 14913.25, import_seq: 3 }),
      makeTx({ date: "2026-08-03", balance: 5000, import_seq: 1 }),
    ];

    expect(computeCurrentBalance(transactions)).toBe(-1169.75);
  });
});
