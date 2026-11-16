import { describe, expect, it } from "vitest";
import { summarizeBudgetForAdvisor } from "./summarizeBudgetForAdvisor";
import type { ActualTransaction } from "./computeBudgetActuals";
import type { BudgetLineRow, Category } from "@/lib/types/db";

const categories: Category[] = [
  { id: "bolig", name: "Bolig", color: null, sort_order: 10 },
  { id: "mad", name: "Mad", color: null, sort_order: 60 },
];

function line(overrides: Partial<BudgetLineRow>): BudgetLineRow {
  return {
    id: "l1",
    budget_id: "b1",
    kind: "expense",
    label: "Post",
    category_id: null,
    mapping_ids: [],
    include_category: false,
    amounts: Array(12).fill(0),
    sort_order: 0,
    created_at: "2027-01-01T00:00:00Z",
    updated_at: "2027-01-01T00:00:00Z",
    ...overrides,
  };
}

let counter = 0;
function tx(overrides: Partial<ActualTransaction>): ActualTransaction {
  counter += 1;
  return {
    id: `tx-${counter}`,
    date: "2027-01-15",
    amount: -100,
    mapping_id: null,
    category_id: null,
    is_extraordinary: false,
    comment: null,
    raw_text: "Tekst",
    ...overrides,
  };
}

const lines = [
  line({ id: "loen", kind: "income", label: "Løn", amounts: Array(12).fill(30000), mapping_ids: ["loen"] }),
  line({ id: "husleje", label: "Husleje", category_id: "bolig", amounts: Array(12).fill(8000), mapping_ids: ["husleje"] }),
  line({ id: "netto", label: "Netto", category_id: "mad", amounts: Array(12).fill(3000), mapping_ids: ["netto"] }),
  line({ id: "frisør", label: "Frisør", category_id: null, amounts: Array(12).fill(300) }),
];

describe("summarizeBudgetForAdvisor", () => {
  it("opsummerer budgettet pr. kategori uden faktiske tal, når året ikke er startet", () => {
    const summary = summarizeBudgetForAdvisor({
      year: 2027,
      startBalance: 10000,
      lines,
      categories,
      transactions: [],
      mappings: [],
      latestTransactionDate: "2026-12-20",
    });

    expect(summary.udgifter_i_alt).toBe(12 * 11300);
    expect(summary.budget_pr_kategori.map((g) => g.kategori)).toEqual([
      "Uden kategori",
      "Bolig",
      "Mad",
      "Uden kategori",
    ]);
    expect(summary.budget_mod_faktisk).toBe("Ingen posteringer fra året endnu.");
  });

  it("sammenligner kun uploadede måneder og vurderer afvigelserne", () => {
    const summary = summarizeBudgetForAdvisor({
      year: 2027,
      startBalance: 0,
      lines,
      categories,
      transactions: [
        tx({ date: "2027-01-01", amount: 30000, mapping_id: "loen" }),
        tx({ date: "2027-01-02", amount: -8000, mapping_id: "husleje" }),
        tx({ date: "2027-01-10", amount: -4200, mapping_id: "netto" }),
        tx({ date: "2027-01-12", amount: -900, mapping_id: "kiosk" }),
        tx({ date: "2027-01-13", amount: -5000, is_extraordinary: true }),
      ],
      mappings: [{ id: "kiosk", label: "Kiosk" }],
      latestTransactionDate: "2027-01-13",
    });

    const comparison = summary.budget_mod_faktisk;
    if (typeof comparison === "string") throw new Error("forventede sammenligning");

    expect(comparison.sammenlignede_maaneder).toEqual(["januar 2027"]);
    expect(comparison.seneste_maaned_er_muligvis_ufuldstaendig).toBe(true);

    const mad = comparison.pr_kategori.find((c) => c.kategori === "Mad")!;
    expect(mad).toMatchObject({ budget: 3000, faktisk: 4200, forskel: 1200 });
    expect(mad.vurdering).toContain("over budget");

    expect(comparison.poster_med_stoerste_afvigelse[0]).toMatchObject({
      post: "Netto",
      forskel: 1200,
    });
    const frisør = comparison.poster_med_stoerste_afvigelse.find((p) => p.post === "Frisør")!;
    expect(frisør.koblet_til_posteringer).toBe(false);

    expect(comparison.ikke_budgetteret.udgifter_i_alt).toBe(900);
    expect(comparison.ikke_budgetteret.stoerste[0]).toMatchObject({ tekst: "Kiosk", beloeb: 900 });
    expect(comparison.ekstraordinaere.udgifter_i_alt).toBe(5000);

    // Budget: 30.000 - 11.300 = 18.700. Faktisk uden ekstraordinære: 30.000 - 13.100 = 16.900.
    expect(comparison.nettoresultat_uden_ekstraordinaere).toEqual({
      budget: 18700,
      faktisk: 16900,
      forskel: -1800,
    });
    expect(comparison.budgetteret_saldo_ved_udgangen_af_seneste_maaned).toBe(18700);
  });
});
