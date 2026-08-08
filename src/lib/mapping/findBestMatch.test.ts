import { describe, expect, it } from "vitest";
import { findBestMatchingRule } from "./findBestMatch";
import type { MappingRule } from "./types";

const rule = (overrides: Partial<MappingRule>): MappingRule => ({
  id: "id",
  matchPattern: "",
  matchType: "prefix",
  comment: null,
  categoryId: null,
  minAmount: null,
  maxAmount: null,
  ...overrides,
});

const tx = (rawText: string, amount = -100) => ({ rawText, amount });

describe("findBestMatchingRule", () => {
  it("returnerer null når ingen regler matcher", () => {
    const rules = [rule({ id: "1", matchPattern: "Netflix" })];
    expect(findBestMatchingRule(tx("Spotify Premium"), rules)).toBeNull();
  });

  it("vælger den mest specifikke regel (længste mønster) ved flere match", () => {
    const generic = rule({ id: "generisk", matchPattern: "TV2" });
    const specific = rule({ id: "specifik", matchPattern: "TV2 DK ID" });

    const result = findBestMatchingRule(
      tx("TV2 DK ID 215445884\\ \\ODENS..."),
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

    expect(findBestMatchingRule(tx("Oister             NIXGG"), rules)?.id).toBe(
      "b",
    );
  });

  it("skelner flere regler med identisk tekst-mønster ud fra beløbsinterval", () => {
    const rules = [
      rule({
        id: "charlotte",
        matchPattern: "If Skadeforsikring",
        minAmount: 136,
        maxAmount: 139,
      }),
      rule({
        id: "sofie",
        matchPattern: "If Skadeforsikring",
        minAmount: 175,
        maxAmount: 178,
      }),
      rule({
        id: "signe",
        matchPattern: "If Skadeforsikring",
        minAmount: 178,
        maxAmount: 180,
      }),
    ];

    expect(
      findBestMatchingRule(tx("If Skadeforsikring", -137.85), rules)?.id,
    ).toBe("charlotte");
    expect(
      findBestMatchingRule(tx("If Skadeforsikring", -176.92), rules)?.id,
    ).toBe("sofie");
    expect(
      findBestMatchingRule(tx("If Skadeforsikring", -178.64), rules)?.id,
    ).toBe("signe");
  });

  it("foretrækker en regel med beløbsinterval frem for en generisk uden, for samme tekst", () => {
    const generic = rule({ id: "generisk", matchPattern: "If Skadeforsikring" });
    const specific = rule({
      id: "charlotte",
      matchPattern: "If Skadeforsikring",
      minAmount: 136,
      maxAmount: 139,
    });

    const result = findBestMatchingRule(
      tx("If Skadeforsikring", -137.85),
      [generic, specific],
    );

    expect(result?.id).toBe("charlotte");
  });

  it("falder tilbage til den generiske regel når beløbet ikke matcher noget specifikt interval", () => {
    const generic = rule({ id: "generisk", matchPattern: "If Skadeforsikring" });
    const charlotte = rule({
      id: "charlotte",
      matchPattern: "If Skadeforsikring",
      minAmount: 136,
      maxAmount: 139,
    });

    const result = findBestMatchingRule(
      tx("If Skadeforsikring", -1347.49),
      [generic, charlotte],
    );

    expect(result?.id).toBe("generisk");
  });

  it("matcher et åbent interval (kun min sat) for et stort, varierende beløb", () => {
    const big = rule({
      id: "big",
      matchPattern: "If Skadeforsikring",
      minAmount: 500,
      maxAmount: null,
    });

    expect(
      findBestMatchingRule(tx("If Skadeforsikring", -1347.49), [big])?.id,
    ).toBe("big");
    expect(
      findBestMatchingRule(tx("If Skadeforsikring", -137.85), [big]),
    ).toBeNull();
  });
});
