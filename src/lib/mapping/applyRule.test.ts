import { describe, expect, it } from "vitest";
import { computeAutoMappingUpdate, findRetroactiveMatches } from "./applyRule";
import type { MappableTransaction, MappingRule } from "./types";

const rule: MappingRule = {
  id: "rule-1",
  matchPattern: "Oister",
  matchType: "prefix",
  comment: "Mobilabonnement",
  categoryId: "cat-mobil",
  minAmount: null,
  maxAmount: null,
  displayMode: "grouped",
  isExtraordinary: false,
};

const untouched = (overrides: Partial<MappableTransaction>): MappableTransaction => ({
  id: "t-1",
  rawText: "Oister NIXGG",
  amount: -99,
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
      isExtraordinary: false,
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

  it("springer over hvis beløbet falder uden for reglens interval", () => {
    const rangedRule: MappingRule = { ...rule, minAmount: 136, maxAmount: 139 };
    expect(
      computeAutoMappingUpdate(untouched({ amount: -176.92 }), rangedRule),
    ).toBeNull();
  });

  it("anvender en regel med beløbsinterval når beløbet falder inden for", () => {
    const rangedRule: MappingRule = { ...rule, minAmount: 136, maxAmount: 139 };
    expect(
      computeAutoMappingUpdate(untouched({ amount: -137.85 }), rangedRule),
    ).not.toBeNull();
  });

  it("sætter ikke kommentar fra en regel med Visning 'individual' - hver postering skal vises for sig", () => {
    const individualRule: MappingRule = { ...rule, displayMode: "individual" };
    const result = computeAutoMappingUpdate(untouched({}), individualRule);
    expect(result).toEqual({
      comment: null,
      categoryId: "cat-mobil",
      mappingId: "rule-1",
      isExtraordinary: false,
    });
  });

  it("markerer matches som ekstraordinære når reglen er det", () => {
    const extraordinaryRule: MappingRule = { ...rule, isExtraordinary: true };
    const result = computeAutoMappingUpdate(untouched({}), extraordinaryRule);
    expect(result?.isExtraordinary).toBe(true);
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
