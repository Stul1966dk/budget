import { describe, expect, it } from "vitest";
import { applyIncomeOverride } from "./applyIncomeOverride";
import type { ForecastMonth } from "./computeExpenseForecast";

const forecast: ForecastMonth[] = [
  {
    monthKey: "2026-08",
    recurringTotal: 20000,
    averageUnmappedTotal: 5000,
    projectedTotal: 25000,
    recurringIncome: 27647.74,
    projectedNetResult: 2647.74,
  },
  {
    monthKey: "2026-09",
    recurringTotal: 20000,
    averageUnmappedTotal: 5000,
    projectedTotal: 25000,
    recurringIncome: 27647.74,
    projectedNetResult: 2647.74,
  },
];

describe("applyIncomeOverride", () => {
  it("lader prognosen stå uændret uden en override", () => {
    expect(applyIncomeOverride(forecast, null)).toEqual(forecast);
  });

  it("erstatter indbetaling og genberegner nettoresultat for alle måneder", () => {
    const result = applyIncomeOverride(forecast, 27500);

    expect(result).toHaveLength(2);
    for (const month of result) {
      expect(month.recurringIncome).toBe(27500);
      expect(month.projectedNetResult).toBe(2500);
    }
  });

  it("ændrer ikke udgiftsdelen af prognosen", () => {
    const result = applyIncomeOverride(forecast, 27500);

    expect(result[0].recurringTotal).toBe(20000);
    expect(result[0].averageUnmappedTotal).toBe(5000);
    expect(result[0].projectedTotal).toBe(25000);
  });
});
