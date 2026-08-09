import { describe, expect, it } from "vitest";
import { computeMonthlyBalances } from "./computeMonthlyBalances";

describe("computeMonthlyBalances", () => {
  it("bruger den seneste kendte saldo pr. måned i det angivne år", () => {
    const result = computeMonthlyBalances(
      [
        { date: "2026-01-05", balance: 1000, import_seq: 1 },
        { date: "2026-01-20", balance: 1500, import_seq: 2 },
        { date: "2026-02-10", balance: 2000, import_seq: 3 },
      ],
      2026,
    );

    expect(result[0]).toBe(1500);
    expect(result[1]).toBe(2000);
    expect(result[2]).toBeNull();
  });

  it("ignorerer posteringer fra andre år", () => {
    const result = computeMonthlyBalances(
      [
        { date: "2025-12-31", balance: 500, import_seq: 1 },
        { date: "2026-01-10", balance: 900, import_seq: 2 },
      ],
      2026,
    );

    expect(result[0]).toBe(900);
    expect(result[11]).toBeNull();
  });

  it("bruger import_seq til at afgøre rækkefølgen når flere posteringer deler samme dato", () => {
    const result = computeMonthlyBalances(
      [
        { date: "2026-03-15", balance: 5000, import_seq: 2 },
        { date: "2026-03-15", balance: 3000, import_seq: 1 },
      ],
      2026,
    );

    expect(result[2]).toBe(5000);
  });

  it("er uafhængig af hentnings-rækkefølgen", () => {
    const result = computeMonthlyBalances(
      [
        { date: "2026-05-20", balance: 2000, import_seq: 1 },
        { date: "2026-05-05", balance: 1000, import_seq: 2 },
      ],
      2026,
    );

    expect(result[4]).toBe(2000);
  });

  it("returnerer 12 nuller-frie null-værdier uden data", () => {
    expect(computeMonthlyBalances([], 2026)).toEqual(new Array(12).fill(null));
  });

  it("springer posteringer uden kendt saldo over", () => {
    const result = computeMonthlyBalances(
      [
        { date: "2026-06-01", balance: 100, import_seq: 1 },
        { date: "2026-06-15", balance: null, import_seq: 2 },
      ],
      2026,
    );

    expect(result[5]).toBe(100);
  });
});
