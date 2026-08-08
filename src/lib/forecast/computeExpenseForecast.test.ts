import { describe, expect, it } from "vitest";
import { computeExpenseForecast } from "./computeExpenseForecast";
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

describe("computeExpenseForecast", () => {
  it("projicerer en månedlig post i hver af de kommende måneder", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -109, mapping_id: "m1" }),
      makeTx({ date: "2026-06-01", amount: -109, mapping_id: "m1" }),
      makeTx({ date: "2026-07-01", amount: -109, mapping_id: "m1" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 3);

    expect(forecast).toHaveLength(3);
    expect(forecast.map((f) => f.monthKey)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(forecast.every((f) => f.recurringTotal === 109)).toBe(true);
  });

  it("bruger det seneste beløb, ikke det ældste, ved prisstigning", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -99, mapping_id: "m1" }),
      makeTx({ date: "2026-06-01", amount: -109, mapping_id: "m1" }),
      makeTx({ date: "2026-07-01", amount: -109, mapping_id: "m1" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 1);

    expect(forecast[0].recurringTotal).toBe(109);
  });

  it("udelader en regel der kun er set én gang - for lidt historik til at udlede et interval", () => {
    const transactions = [
      makeTx({ date: "2026-07-01", amount: -50, mapping_id: "m1" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 3);

    expect(forecast.every((f) => f.recurringTotal === 0)).toBe(true);
  });

  it("projicerer en halvårlig post (fx ejerafgift) kun på de måneder den forventes igen", () => {
    const transactions = [
      makeTx({ date: "2026-01-01", amount: -700, mapping_id: "car-tax" }),
      makeTx({ date: "2026-07-01", amount: -700, mapping_id: "car-tax" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 12);

    const withTax = forecast.filter((f) => f.recurringTotal > 0);
    expect(withTax.map((f) => f.monthKey)).toEqual(["2027-01", "2027-07"]);
    expect(withTax.every((f) => f.recurringTotal === 700)).toBe(true);

    const withoutTax = forecast.filter((f) => f.recurringTotal === 0);
    expect(withoutTax).toHaveLength(10);
  });

  it("regner en post som ophørt, hvis den er markant forsinket ift. sit eget interval", () => {
    const transactions = [
      // Interval på 1 måned, men er ikke set i 5 måneder - må formodes stoppet.
      makeTx({ date: "2026-01-01", amount: -500, mapping_id: "old-rent" }),
      makeTx({ date: "2026-02-01", amount: -500, mapping_id: "old-rent" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 3);

    expect(forecast.every((f) => f.recurringTotal === 0)).toBe(true);
  });

  it("medregner gennemsnittet af umappede posteringer i de seneste 3 måneder", () => {
    const transactions = [
      makeTx({ date: "2026-05-15", amount: -200, mapping_id: null }),
      makeTx({ date: "2026-06-15", amount: -400, mapping_id: null }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 1);

    expect(forecast[0].averageUnmappedTotal).toBe(300);
  });

  it("projicerer en fast indbetaling ligesom en fast udgift", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: 16500, mapping_id: "income" }),
      makeTx({ date: "2026-06-01", amount: 16500, mapping_id: "income" }),
      makeTx({ date: "2026-07-01", amount: 16500, mapping_id: "income" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 1);

    expect(forecast[0].recurringIncome).toBe(16500);
  });

  it("summerer flere indbetalinger under samme regel inden for én måned", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: 16500, mapping_id: "income" }),
      makeTx({ date: "2026-06-01", amount: 16500, mapping_id: "income" }),
      makeTx({ date: "2026-07-01", amount: 16500, mapping_id: "income" }),
      makeTx({ date: "2026-07-27", amount: 11000, mapping_id: "income" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 1);

    expect(forecast[0].recurringIncome).toBe(27500);
  });

  it("udelader en regel der er manuelt markeret som afsluttet, selvom den ellers ville projiceres", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: -3200, mapping_id: "realkredit" }),
      makeTx({ date: "2026-06-01", amount: -3200, mapping_id: "realkredit" }),
      makeTx({ date: "2026-07-01", amount: -3200, mapping_id: "realkredit" }),
    ];

    const forecast = computeExpenseForecast(
      transactions,
      "2026-07",
      3,
      new Set(["realkredit"]),
    );

    expect(forecast.every((f) => f.recurringTotal === 0)).toBe(true);
  });

  it("beregner et forventet nettoresultat ud fra indbetaling minus udgifter", () => {
    const transactions = [
      makeTx({ date: "2026-05-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-06-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-07-01", amount: 20000, mapping_id: "income" }),
      makeTx({ date: "2026-05-01", amount: -15000, mapping_id: "rent" }),
      makeTx({ date: "2026-06-01", amount: -15000, mapping_id: "rent" }),
      makeTx({ date: "2026-07-01", amount: -15000, mapping_id: "rent" }),
    ];

    const forecast = computeExpenseForecast(transactions, "2026-07", 1);

    expect(forecast[0].recurringIncome).toBe(20000);
    expect(forecast[0].projectedTotal).toBe(15000);
    expect(forecast[0].projectedNetResult).toBe(5000);
  });
});
