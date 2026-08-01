/**
 * Deterministisk hash af (dato + tekst + beløb + saldo) til dublet-beskyttelse.
 * Ikke-kryptografisk (FNV-1a) - hurtig og synkron, hvilket holder parseren
 * simpel både i preview (browser) og ved faktisk import (server).
 */
export function computeRowHash(row: {
  date: string;
  rawText: string;
  amount: number;
  balance: number | null;
}): string {
  const key = [row.date, row.rawText, row.amount, row.balance ?? ""].join(
    "|",
  );

  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
