/**
 * Foreslår et prefix-mønster ud fra en rå posteringstekst ved at fjerne
 * afsluttende tal/koder, som typisk er det der varierer måned til måned
 * (fx "Oister NIXGG" -> "Oister", "go2fitness.dk/ 48722" -> "go2fitness.dk/").
 * Brugeren kan altid redigere forslaget - det er et udgangspunkt, ikke facit.
 */
export function suggestMappingPattern(rawText: string): string {
  const collapsed = rawText.trim().replace(/\s+/g, " ");
  const tokens = collapsed.split(" ");

  const looksLikeVariableCode = (token: string) =>
    /\d/.test(token) || token.includes("\\") || /^[A-Z0-9]{3,}$/.test(token);

  while (tokens.length > 1 && looksLikeVariableCode(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ").trim();
}
