import type { ForecastMonth } from "./computeExpenseForecast";

/**
 * Erstatter den automatisk genkendte indbetaling med en manuel værdi, hvis
 * husstanden har angivet én (fx efter en lønstigning der endnu ikke har
 * optrådt nok måneder til at blive genkendt automatisk).
 */
export function applyIncomeOverride(
  forecast: ForecastMonth[],
  overrideValue: number | null,
): ForecastMonth[] {
  if (overrideValue === null) return forecast;

  return forecast.map((f) => ({
    ...f,
    recurringIncome: overrideValue,
    projectedNetResult: overrideValue - f.projectedTotal,
  }));
}
