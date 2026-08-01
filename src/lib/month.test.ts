import { describe, expect, it } from "vitest";
import { extractMonthKey, monthDiff, monthKeyToDateRange, shiftMonthKey } from "./month";

describe("shiftMonthKey", () => {
  it("går en måned frem inden for samme år", () => {
    expect(shiftMonthKey("2026-01", 1)).toBe("2026-02");
  });

  it("går en måned tilbage over et årsskifte", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("går flere måneder frem over et årsskifte", () => {
    expect(shiftMonthKey("2026-11", 3)).toBe("2027-02");
  });
});

describe("monthKeyToDateRange", () => {
  it("finder korrekt sidste dag i en måned med 31 dage", () => {
    expect(monthKeyToDateRange("2026-01")).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("finder korrekt sidste dag i februar i et skudår", () => {
    expect(monthKeyToDateRange("2028-02")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("finder korrekt sidste dag i februar i et almindeligt år", () => {
    expect(monthKeyToDateRange("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });
});

describe("extractMonthKey", () => {
  it("udtrækker månedsnøgle fra en ISO-dato", () => {
    expect(extractMonthKey("2026-03-17")).toBe("2026-03");
  });
});

describe("monthDiff", () => {
  it("beregner positiv difference inden for samme år", () => {
    expect(monthDiff("2026-03", "2026-09")).toBe(6);
  });

  it("beregner negativ difference når b er før a", () => {
    expect(monthDiff("2026-09", "2026-03")).toBe(-6);
  });

  it("beregner difference over et årsskifte", () => {
    expect(monthDiff("2025-11", "2026-02")).toBe(3);
  });

  it("returnerer 0 for samme måned", () => {
    expect(monthDiff("2026-05", "2026-05")).toBe(0);
  });
});
