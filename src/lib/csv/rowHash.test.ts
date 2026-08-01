import { describe, expect, it } from "vitest";
import { computeRowHash } from "./rowHash";

describe("computeRowHash", () => {
  const base = { date: "2026-01-02", rawText: "Oister NIXGG", amount: -99, balance: -186.91 };

  it("er deterministisk for identiske rækker", () => {
    expect(computeRowHash(base)).toBe(computeRowHash({ ...base }));
  });

  it("giver forskellig hash når beløbet ændres", () => {
    expect(computeRowHash(base)).not.toBe(
      computeRowHash({ ...base, amount: -100 }),
    );
  });

  it("giver forskellig hash når teksten ændres (fx nyt Oister-suffiks)", () => {
    expect(computeRowHash(base)).not.toBe(
      computeRowHash({ ...base, rawText: "Oister NJI4B" }),
    );
  });

  it("giver forskellig hash når saldoen ændres", () => {
    expect(computeRowHash(base)).not.toBe(
      computeRowHash({ ...base, balance: -285.91 }),
    );
  });

  it("giver forskellig hash når datoen ændres", () => {
    expect(computeRowHash(base)).not.toBe(
      computeRowHash({ ...base, date: "2026-01-03" }),
    );
  });

  it("håndterer null-saldo uden at kaste fejl", () => {
    expect(() => computeRowHash({ ...base, balance: null })).not.toThrow();
  });
});
