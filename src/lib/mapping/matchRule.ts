import { normalizeText } from "./normalizeText";
import type { MatchType } from "./types";

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
