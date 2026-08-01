import { describe, expect, it } from "vitest";
import { parseDanishDate } from "./parseDate";

describe("parseDanishDate", () => {
  it("konverterer DD.MM.YYYY til ISO-dato", () => {
    expect(parseDanishDate("02.01.2026")).toBe("2026-01-02");
  });

  it("konverterer en dato sidst på året korrekt", () => {
    expect(parseDanishDate("31.12.2025")).toBe("2025-12-31");
  });

  it("kaster fejl ved forkert format", () => {
    expect(() => parseDanishDate("2026-01-02")).toThrow(/Ugyldigt datoformat/);
  });

  it("kaster fejl ved ugyldig kalenderdato (30. februar)", () => {
    expect(() => parseDanishDate("30.02.2026")).toThrow(
      /Ugyldig kalenderdato/,
    );
  });

  it("kaster fejl ved ugyldig måned", () => {
    expect(() => parseDanishDate("15.13.2026")).toThrow(
      /Ugyldig kalenderdato/,
    );
  });
});
