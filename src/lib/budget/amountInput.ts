import { parseDanishAmount } from "@/lib/csv/parseAmount";

const inputFormatter = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

/** Viser et beløb i et inputfelt som "8.000" eller "1.234,5". 0 vises som tomt felt. */
export function formatAmountInput(value: number): string {
  return value === 0 ? "" : inputFormatter.format(value);
}

/**
 * Læser et beløb skrevet i dansk format ("8.000", "1234,50", "500").
 * Tomt felt = 0. Returnerer null ved ugyldigt eller negativt beløb.
 */
export function parseAmountInput(raw: string): number | null {
  const trimmed = raw.replace(/\s|kr\.?/gi, "");
  if (trimmed === "") return 0;
  try {
    const value = parseDanishAmount(trimmed);
    if (value === null || !Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  } catch {
    return null;
  }
}
