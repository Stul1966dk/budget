import { ruleMatchesText } from "./matchRule";
import { normalizeText } from "./normalizeText";
import type { MappingRule } from "./types";

/**
 * Finder den bedste matchende regel for en rå posteringstekst. Hvis flere
 * regler matcher, vinder den med det længste (normaliserede) mønster - et
 * mere specifikt mønster slår et generisk et.
 */
export function findBestMatchingRule(
  rawText: string,
  rules: MappingRule[],
): MappingRule | null {
  const matches = rules.filter((rule) =>
    ruleMatchesText(rawText, rule.matchPattern, rule.matchType),
  );

  if (matches.length === 0) return null;

  return matches.reduce((best, current) =>
    normalizeText(current.matchPattern).length >
    normalizeText(best.matchPattern).length
      ? current
      : best,
  );
}
