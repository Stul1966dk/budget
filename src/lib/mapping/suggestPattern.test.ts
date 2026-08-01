import { describe, expect, it } from "vitest";
import { suggestMappingPattern } from "./suggestPattern";

describe("suggestMappingPattern", () => {
  it("fjerner et afsluttende kode-suffiks (Oister)", () => {
    expect(suggestMappingPattern("Oister             NIXGG")).toBe("Oister");
  });

  it("fjerner et afsluttende tal-suffiks (go2fitness)", () => {
    expect(suggestMappingPattern("go2fitness.dk/     48722")).toBe(
      "go2fitness.dk/",
    );
  });

  it("fjerner flere afsluttende koder (TV2)", () => {
    expect(
      suggestMappingPattern("TV2 DK ID 215445884\\ \\ODENS..."),
    ).toBe("TV2 DK ID");
  });

  it("bevarer teksten uændret når intet ligner en variabel kode", () => {
    expect(suggestMappingPattern("Det Faglige Hus")).toBe("Det Faglige Hus");
  });
});
