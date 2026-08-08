import { ruleMatchesTransaction } from "./matchRule";
import { normalizeText } from "./normalizeText";
import type { MappingRule } from "./types";

/**
 * Finder den bedste matchende regel for en postering. Flere regler kan dele
 * helt identisk tekst-mønster (fx flere forsikringer faktureret under samme
 * banktekst) - derfor vinder først en regel med et beløbsinterval over en
 * uden (mere specifik slår generisk), og først derefter det længste
 * (normaliserede) tekst-mønster.
 */
export function findBestMatchingRule(
  transaction: { rawText: string; amount: number },
  rules: MappingRule[],
): MappingRule | null {
  const matches = rules.filter((rule) => ruleMatchesTransaction(transaction, rule));

  if (matches.length === 0) return null;

  return matches.reduce((best, current) => {
    const currentHasRange = current.minAmount !== null || current.maxAmount !== null;
    const bestHasRange = best.minAmount !== null || best.maxAmount !== null;
    if (currentHasRange !== bestHasRange) return currentHasRange ? current : best;

    return normalizeText(current.matchPattern).length >
      normalizeText(best.matchPattern).length
      ? current
      : best;
  });
}
