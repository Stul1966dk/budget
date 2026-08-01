import { ruleMatchesText } from "./matchRule";
import type { MappableTransaction, MappingRule } from "./types";

/**
 * En postering er kun kandidat til automatisk mapping hvis den er helt
 * "urørt" - ingen tidligere regel, kommentar eller kategori. Det garanterer
 * at en manuel kommentar (eller en tidligere regel-tildeling) aldrig bliver
 * overskrevet, jf. kravet om at manuel kommentar altid overtrumfer reglen.
 */
export function isEligibleForAutoMapping(
  transaction: MappableTransaction,
): boolean {
  return (
    transaction.mappingId === null &&
    transaction.comment === null &&
    transaction.categoryId === null
  );
}

export type AutoMappingUpdate = {
  comment: string | null;
  categoryId: string | null;
  mappingId: string;
};

/**
 * Beregner den opdatering en regel vil give en postering, eller null hvis
 * reglen ikke matcher eller posteringen ikke er urørt.
 */
export function computeAutoMappingUpdate(
  transaction: MappableTransaction,
  rule: MappingRule,
): AutoMappingUpdate | null {
  if (!isEligibleForAutoMapping(transaction)) return null;
  if (!ruleMatchesText(transaction.rawText, rule.matchPattern, rule.matchType)) {
    return null;
  }

  return {
    comment: rule.comment,
    categoryId: rule.categoryId,
    mappingId: rule.id,
  };
}

/**
 * Finder alle posteringer en regel vil ramme, hvis den anvendes retroaktivt.
 * Bruges til at vise "Reglen matcher X eksisterende posteringer - anvend?".
 */
export function findRetroactiveMatches(
  rule: MappingRule,
  transactions: MappableTransaction[],
): MappableTransaction[] {
  return transactions.filter(
    (t) => computeAutoMappingUpdate(t, rule) !== null,
  );
}
