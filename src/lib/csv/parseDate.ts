/**
 * Danske Bank-datoformat "DD.MM.YYYY" -> ISO-dato "YYYY-MM-DD".
 */
export function parseDanishDate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    throw new Error(`Ugyldigt datoformat: "${raw}"`);
  }

  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  const date = new Date(Date.UTC(y, m - 1, d));
  const isValid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;

  if (!isValid) {
    throw new Error(`Ugyldig kalenderdato: "${raw}"`);
  }

  return `${year}-${month}-${day}`;
}
