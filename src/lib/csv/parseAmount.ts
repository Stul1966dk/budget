/**
 * Dansk talformat: punktum som tusindtalsseparator, komma som decimal.
 * "-1.827,56" -> -1827.56. Tom streng -> null (bruges til nullable Saldo).
 */
export function parseDanishAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);

  if (Number.isNaN(value)) {
    throw new Error(`Ugyldigt beløbsformat: "${raw}"`);
  }

  return value;
}
