/**
 * Danske Bank-eksporter er windows-1252, ikke UTF-8. Vi prøver UTF-8 først
 * (fatal, så ugyldige byte-sekvenser kaster) og falder tilbage til
 * windows-1252, som kan afkode enhver byte-sekvens uden fejl.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
