import { normalizeText } from "./normalizeText";
import type { MappingRule, MatchType } from "./types";

export function ruleMatchesText(
  rawText: string,
  matchPattern: string,
  matchType: MatchType,
): boolean {
  const text = normalizeText(rawText);
  const pattern = normalizeText(matchPattern);

  if (!pattern) return false;

  switch (matchType) {
    case "prefix":
      return text.startsWith(pattern);
    case "contains":
      return text.includes(pattern);
    case "exact":
      return text === pattern;
  }
}

/**
 * Tjekker om en posterings beløb (absolut værdi, uden fortegn) falder inden
 * for reglens beløbsinterval. En regel uden interval (begge felter null)
 * matcher ethvert beløb.
 */
export function amountMatchesRange(
  amount: number,
  rule: Pick<MappingRule, "minAmount" | "maxAmount">,
): boolean {
  const magnitude = Math.abs(amount);
  if (rule.minAmount !== null && magnitude < rule.minAmount) return false;
  if (rule.maxAmount !== null && magnitude > rule.maxAmount) return false;
  return true;
}

export function ruleMatchesTransaction(
  transaction: { rawText: string; amount: number },
  rule: MappingRule,
): boolean {
  return (
    ruleMatchesText(transaction.rawText, rule.matchPattern, rule.matchType) &&
    amountMatchesRange(transaction.amount, rule)
  );
}
