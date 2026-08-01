/**
 * Normalisering før matching: trim, kollaps gentagne mellemrum til ét,
 * lowercase. Bankens tekster varierer i whitespace og caps fra måned til
 * måned, så matching sker altid på den normaliserede form.
 */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
