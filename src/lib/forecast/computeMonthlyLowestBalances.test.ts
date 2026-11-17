import { describe, expect, it } from "vitest";
import { computeMonthlyLowestBalances } from "./computeMonthlyLowestBalances";

describe("computeMonthlyLowestBalances", () => {
  it("finder den laveste saldo i hver måned", () => {
    const result = computeMonthlyLowestBalances(
      [
        { date: "2026-01-05", balance: 1000 },
        { date: "2026-01-12", balance: -250 },
        { date: "2026-01-20", balance: 1500 },
        { date: "2026-02-10", balance: 2000 },
      ],
      2026,
    );

    expect(result[0]).toBe(-250);
    expect(result[1]).toBe(2000);
    expect(result[2]).toBeNull();
  });

  it("ignorerer posteringer uden saldo og fra andre år", () => {
    const result = computeMonthlyLowestBalances(
      [
        { date: "2025-01-10", balance: -9000 },
        { date: "2026-01-10", balance: null },
        { date: "2026-01-11", balance: 300 },
      ],
      2026,
    );

    expect(result[0]).toBe(300);
  });
});
