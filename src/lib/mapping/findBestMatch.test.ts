import { describe, expect, it } from "vitest";
import { findBestMatchingRule } from "./findBestMatch";
import type { MappingRule } from "./types";

const rule = (overrides: Partial<MappingRule>): MappingRule => ({
  id: "id",
  matchPattern: "",
  matchType: "prefix",
  comment: null,
  categoryId: null,
  ...overrides,
});

describe("findBestMatchingRule", () => {
  it("returnerer null når ingen regler matcher", () => {
    const rules = [rule({ id: "1", matchPattern: "Netflix" })];
    expect(findBestMatchingRule("Spotify Premium", rules)).toBeNull();
  });

  it("vælger den mest specifikke regel (længste mønster) ved flere match", () => {
    const generic = rule({ id: "generisk", matchPattern: "TV2" });
    const specific = rule({ id: "specifik", matchPattern: "TV2 DK ID" });

    const result = findBestMatchingRule(
      "TV2 DK ID 215445884\\ \\ODENS...",
      [generic, specific],
    );

    expect(result?.id).toBe("specifik");
  });

  it("finder korrekt regel blandt flere ikke-matchende regler", () => {
    const rules = [
      rule({ id: "a", matchPattern: "Netflix" }),
      rule({ id: "b", matchPattern: "Oister" }),
      rule({ id: "c", matchPattern: "Mofibo" }),
    ];

    expect(
      findBestMatchingRule("Oister             NIXGG", rules)?.id,
    ).toBe("b");
  });
});
