import { describe, expect, it } from "vitest";
import { ruleMatchesText } from "./matchRule";

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
