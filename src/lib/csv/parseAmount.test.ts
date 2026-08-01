import { describe, expect, it } from "vitest";
import { parseDanishAmount } from "./parseAmount";

describe("parseDanishAmount", () => {
  it("parser negative beløb med tusindtalsseparator", () => {
    expect(parseDanishAmount("-1.827,56")).toBe(-1827.56);
  });

  it("parser store saldi med flere tusindtalsseparatorer", () => {
    expect(parseDanishAmount("2.273.326,57")).toBe(2273326.57);
  });

  it("parser positive beløb", () => {
    expect(parseDanishAmount("10.550,00")).toBe(10550);
  });

  it("parser beløb uden tusindtalsseparator", () => {
    expect(parseDanishAmount("-99,00")).toBe(-99);
  });

  it("parser beløb uden decimaler eller tusindtalsseparator", () => {
    expect(parseDanishAmount("-607")).toBe(-607);
  });

  it("håndterer whitespace omkring beløbet", () => {
    expect(parseDanishAmount("  -308,00  ")).toBe(-308);
  });

  it("returnerer null for tom streng (nullable saldo)", () => {
    expect(parseDanishAmount("")).toBeNull();
    expect(parseDanishAmount("   ")).toBeNull();
  });

  it("kaster fejl ved ugyldigt beløbsformat", () => {
    expect(() => parseDanishAmount("ikke-et-tal")).toThrow(
      /Ugyldigt beløbsformat/,
    );
  });
});
