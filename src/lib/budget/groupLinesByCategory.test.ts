import { describe, expect, it } from "vitest";
import { groupLinesByCategory } from "./groupLinesByCategory";

describe("groupLinesByCategory", () => {
  const categories = [
    { id: "mad", name: "Mad", color: null, sort_order: 60 },
    { id: "bolig", name: "Bolig", color: null, sort_order: 10 },
  ];

  it("grupperer i kategoriernes rækkefølge med 'uden kategori' til sidst", () => {
    const groups = groupLinesByCategory(
      [
        { id: "a", category_id: "mad" },
        { id: "b", category_id: null },
        { id: "c", category_id: "bolig" },
        { id: "d", category_id: "mad" },
        { id: "e", category_id: "slettet" },
      ],
      categories,
    );

    expect(groups.map((g) => g.category?.name ?? null)).toEqual(["Bolig", "Mad", null]);
    expect(groups[1].lines.map((l) => l.id)).toEqual(["a", "d"]);
    expect(groups[2].lines.map((l) => l.id)).toEqual(["b", "e"]);
  });
});
