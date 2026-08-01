import { describe, expect, it } from "vitest";
import { computeAutoMappingUpdate, findRetroactiveMatches } from "./applyRule";
import type { MappableTransaction, MappingRule } from "./types";

const rule: MappingRule = {
  id: "rule-1",
  matchPattern: "Oister",
  matchType: "prefix",
  comment: "Mobilabonnement",
  categoryId: "cat-mobil",
};

const untouched = (overrides: Partial<MappableTransaction>): MappableTransaction => ({
  id: "t-1",
  rawText: "Oister NIXGG",
  comment: null,
  categoryId: null,
  mappingId: null,
  ...overrides,
});

describe("computeAutoMappingUpdate", () => {
  it("anvender reglen på en urørt, matchende postering", () => {
    const result = computeAutoMappingUpdate(untouched({}), rule);
    expect(result).toEqual({
      comment: "Mobilabonnement",
      categoryId: "cat-mobil",
      mappingId: "rule-1",
    });
  });

  it("springer over hvis reglen ikke matcher", () => {
    expect(
      computeAutoMappingUpdate(untouched({ rawText: "Netflix" }), rule),
    ).toBeNull();
  });

  it("overskriver aldrig en manuel kommentar", () => {
    const result = computeAutoMappingUpdate(
      untouched({ comment: "Charlottes eget abonnement" }),
      rule,
    );
    expect(result).toBeNull();
  });

  it("overskriver aldrig en tidligere regel-tildeling", () => {
    const result = computeAutoMappingUpdate(
      untouched({ mappingId: "andet-rule-id" }),
      rule,
    );
    expect(result).toBeNull();
  });
});

describe("findRetroactiveMatches", () => {
  it("finder kun urørte posteringer der matcher reglen", () => {
    const transactions: MappableTransaction[] = [
      untouched({ id: "t-1", rawText: "Oister NIXGG" }),
      untouched({ id: "t-2", rawText: "Oister NJI4B" }),
      untouched({ id: "t-3", rawText: "Netflix" }),
      untouched({ id: "t-4", rawText: "Oister PBQBV", comment: "Manuel note" }),
    ];

    const matches = findRetroactiveMatches(rule, transactions);
    expect(matches.map((t) => t.id)).toEqual(["t-1", "t-2"]);
  });
});
