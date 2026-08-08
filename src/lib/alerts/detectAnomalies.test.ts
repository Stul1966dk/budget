import { describe, expect, it } from "vitest";
import {
  detectMissingRecurring,
  detectPriceIncreases,
  detectUnusualAmounts,
} from "./detectAnomalies";
import type { TransactionRow } from "@/lib/types/db";

let counter = 0;
function makeTx(overrides: Partial<TransactionRow>): TransactionRow {
  counter += 1;
  return {
    id: `tx-${counter}`,
    date: "2026-01-01",
    raw_text: "Test",
    amount: -100,
    balance: null,
    status: null,
    reconciled: null,
    row_hash: `hash-${counter}`,
    comment: null,
    category_id: null,
    is_extraordinary: false,
    mapping_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("detectPriceIncreases", () => {
  it("flager en postering der er steget mere end 2% siden sidst", () => {
    const previous = makeTx({ date: "2026-06-01", amount: -99, mapping_id: "m1" });
    const current = makeTx({ date: "2026-07-01", amount: -109, mapping_id: "m1" });

    const alerts = detectPriceIncreases([current], [previous, current]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "price_increase",
      mapping_id: "m1",
      previous_amount: -99,
      new_amount: -109,
    });
  });

  it("flager ikke en uændret postering", () => {
    const previous = makeTx({ date: "2026-06-01", amount: -99, mapping_id: "m1" });
    const current = makeTx({ date: "2026-07-01", amount: -99, mapping_id: "m1" });

    expect(detectPriceIncreases([current], [previous, current])).toHaveLength(0);
  });

  it("flager ikke en marginal stigning under tærsklen", () => {
    const previous = makeTx({ date: "2026-06-01", amount: -100, mapping_id: "m1" });
    const current = makeTx({ date: "2026-07-01", amount: -100.5, mapping_id: "m1" });

    expect(detectPriceIncreases([current], [previous, current])).toHaveLength(0);
  });

  it("ignorerer posteringer uden mapping-regel", () => {
    const current = makeTx({ date: "2026-07-01", amount: -109, mapping_id: null });

    expect(detectPriceIncreases([current], [current])).toHaveLength(0);
  });

  it("ignorerer ekstraordinære posteringer", () => {
    const previous = makeTx({ date: "2026-06-01", amount: -99, mapping_id: "m1" });
    const current = makeTx({
      date: "2026-07-01",
      amount: -109,
      mapping_id: "m1",
      is_extraordinary: true,
    });

    expect(detectPriceIncreases([current], [previous, current])).toHaveLength(0);
  });

  it("sammenligner med den seneste tidligere postering, ikke den ældste", () => {
    const older = makeTx({ date: "2026-05-01", amount: -80, mapping_id: "m1" });
    const newer = makeTx({ date: "2026-06-01", amount: -109, mapping_id: "m1" });
    const current = makeTx({ date: "2026-07-01", amount: -109, mapping_id: "m1" });

    expect(
      detectPriceIncreases([current], [older, newer, current]),
    ).toHaveLength(0);
  });
});

describe("detectUnusualAmounts", () => {
  it("flager en umappet postering der er markant større end kategori-gennemsnittet", () => {
    const history = [
      makeTx({ amount: -100, category_id: "c1" }),
      makeTx({ amount: -120, category_id: "c1" }),
      makeTx({ amount: -110, category_id: "c1" }),
    ];
    const current = makeTx({ amount: -900, category_id: "c1", mapping_id: null });

    const alerts = detectUnusualAmounts([current], [...history, current]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "unusual_amount", new_amount: -900 });
  });

  it("flager ikke når der er for få tidligere posteringer at sammenligne med", () => {
    const history = [
      makeTx({ amount: -100, category_id: "c1" }),
      makeTx({ amount: -120, category_id: "c1" }),
    ];
    const current = makeTx({ amount: -900, category_id: "c1", mapping_id: null });

    expect(detectUnusualAmounts([current], [...history, current])).toHaveLength(0);
  });

  it("ignorerer posteringer med en mapping-regel (dækkes af price_increase)", () => {
    const history = [
      makeTx({ amount: -100, category_id: "c1" }),
      makeTx({ amount: -120, category_id: "c1" }),
      makeTx({ amount: -110, category_id: "c1" }),
    ];
    const current = makeTx({ amount: -900, category_id: "c1", mapping_id: "m1" });

    expect(detectUnusualAmounts([current], [...history, current])).toHaveLength(0);
  });
});

describe("detectMissingRecurring", () => {
  it("flager en mapping-regel der plejede at komme, men mangler i den nye måned (efter dens typiske dag)", () => {
    const may = makeTx({ date: "2026-05-15", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-15", mapping_id: "m1" });
    // m2 repræsenterer hvor meget af juli der rent faktisk er uploadet -
    // den 20. er forbi m1's typiske dag (15.) + margin.
    const july = makeTx({ date: "2026-07-20", mapping_id: "m2" });

    const labels = new Map([["m1", "Oister"]]);
    const alerts = detectMissingRecurring(
      [july],
      [may, june, july],
      labels,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "missing_recurring",
      mapping_id: "m1",
      label: "Oister",
      month_key: "2026-07",
      typical_day: 15,
    });
  });

  it("flager ikke hvis reglen stadig optræder i den nye måned", () => {
    const may = makeTx({ date: "2026-05-15", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-15", mapping_id: "m1" });
    const july = makeTx({ date: "2026-07-15", mapping_id: "m1" });

    expect(
      detectMissingRecurring([july], [may, june, july], new Map()),
    ).toHaveLength(0);
  });

  it("flager ikke hvis reglen kun optrådte i én af de to foregående måneder", () => {
    const june = makeTx({ date: "2026-06-15", mapping_id: "m1" });
    const july = makeTx({ date: "2026-07-20", mapping_id: "m2" });

    expect(
      detectMissingRecurring([july], [june, july], new Map()),
    ).toHaveLength(0);
  });

  it("flager ikke en regel der er manuelt markeret som afsluttet", () => {
    const may = makeTx({ date: "2026-05-15", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-15", mapping_id: "m1" });
    const july = makeTx({ date: "2026-07-20", mapping_id: "m2" });

    const labels = new Map([["m1", "Realkredit Danmark"]]);
    const alerts = detectMissingRecurring(
      [july],
      [may, june, july],
      labels,
      new Set(["m1"]),
    );

    expect(alerts).toHaveLength(0);
  });

  it("flager ikke hvis vi endnu ikke har uploadet forbi den typiske dag + margin", () => {
    // m1 plejer at komme omkring den 20. - vi har kun uploadet juli til og
    // med den 8., så det er for tidligt at konkludere den mangler.
    const may = makeTx({ date: "2026-05-20", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-20", mapping_id: "m1" });
    const july = makeTx({ date: "2026-07-08", mapping_id: "m2" });

    expect(
      detectMissingRecurring([july], [may, june, july], new Map()),
    ).toHaveLength(0);
  });

  it("flager når vi har uploadet forbi den typiske dag + margin, uden posten er dukket op", () => {
    const may = makeTx({ date: "2026-05-20", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-20", mapping_id: "m1" });
    // Den 25. er forbi den 20. + 3 dages margin.
    const july = makeTx({ date: "2026-07-25", mapping_id: "m2" });

    const alerts = detectMissingRecurring([july], [may, june, july], new Map());

    expect(alerts).toHaveLength(1);
    expect(alerts[0].typical_day).toBe(20);
  });

  it("bruger median af historiske dage som den typiske dag", () => {
    const apr = makeTx({ date: "2026-04-18", mapping_id: "m1" });
    const may = makeTx({ date: "2026-05-20", mapping_id: "m1" });
    const june = makeTx({ date: "2026-06-22", mapping_id: "m1" });
    const july = makeTx({ date: "2026-07-25", mapping_id: "m2" });

    const alerts = detectMissingRecurring(
      [july],
      [apr, may, june, july],
      new Map(),
    );

    expect(alerts[0].typical_day).toBe(20);
  });
});
