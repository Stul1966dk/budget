import { describe, expect, it } from "vitest";
import { amountMatchesRange, ruleMatchesText } from "./matchRule";

describe("ruleMatchesText", () => {
  it("matcher prefix uafhængigt af suffiks-variation (Oister)", () => {
    expect(ruleMatchesText("Oister             NIXGG", "Oister", "prefix")).toBe(
      true,
    );
    expect(ruleMatchesText("Oister             NJI4B", "Oister", "prefix")).toBe(
      true,
    );
  });

  it("matcher contains når præfikset varierer (Vindstød)", () => {
    expect(
      ruleMatchesText("2025-12 Vindstød VE", "Vindstød", "contains"),
    ).toBe(true);
    expect(
      ruleMatchesText("2026-01 Vindstød VE", "Vindstød", "contains"),
    ).toBe(true);
  });

  it("matcher exact kun ved fuldstændigt match", () => {
    expect(ruleMatchesText("Opsparing", "Opsparing", "exact")).toBe(true);
    expect(ruleMatchesText("Opsparing ekstra", "Opsparing", "exact")).toBe(
      false,
    );
  });

  it("er ufølsom over for store/små bogstaver og whitespace", () => {
    expect(ruleMatchesText("  SPOTIFY  Premium", "spotify", "prefix")).toBe(
      true,
    );
  });

  it("matcher ikke når mønsteret ikke findes i teksten", () => {
    expect(ruleMatchesText("Netflix", "Spotify", "prefix")).toBe(false);
  });
});

describe("amountMatchesRange", () => {
  it("matcher ethvert beløb når intervallet er tomt", () => {
    expect(amountMatchesRange(-137.85, { minAmount: null, maxAmount: null })).toBe(
      true,
    );
  });

  it("bruger beløbets absolutte værdi, uafhængigt af fortegn", () => {
    expect(
      amountMatchesRange(-137.85, { minAmount: 136, maxAmount: 139 }),
    ).toBe(true);
    expect(
      amountMatchesRange(137.85, { minAmount: 136, maxAmount: 139 }),
    ).toBe(true);
  });

  it("afviser et beløb under et sat minimum", () => {
    expect(amountMatchesRange(-100, { minAmount: 136, maxAmount: null })).toBe(
      false,
    );
  });

  it("afviser et beløb over et sat maksimum", () => {
    expect(amountMatchesRange(-200, { minAmount: null, maxAmount: 139 })).toBe(
      false,
    );
  });

  it("understøtter et åbent interval (kun min sat)", () => {
    expect(amountMatchesRange(-1347.49, { minAmount: 500, maxAmount: null })).toBe(
      true,
    );
    expect(amountMatchesRange(-137.85, { minAmount: 500, maxAmount: null })).toBe(
      false,
    );
  });
});
