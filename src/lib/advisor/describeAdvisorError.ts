import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ADVISOR_MODEL, MaxTokensError, MissingApiKeyError } from "./advisorClient";

/**
 * Oversætter en fejl fra Claude-kaldet til en besked husstanden kan handle på.
 * Beskederne peger på selve årsagen (manglende nøgle, afvist nøgle, forkert
 * model, manglende kredit ...) i stedet for den gamle catch-all "Tjek at
 * ANTHROPIC_API_KEY er sat", der var forkert i de fleste tilfælde.
 *
 * Kun fejl fra Anthropic-API'et beskrives her - databasefejl må aldrig sendes
 * rå til browseren og håndteres af kalderen.
 */
export function describeAdvisorError(err: unknown, model: string = DEFAULT_ADVISOR_MODEL): string {
  if (err instanceof MissingApiKeyError) {
    return (
      "ANTHROPIC_API_KEY er ikke sat i det miljø appen kører i. " +
      "Tilføj den under Vercel → Project Settings → Environment Variables (eller i .env.local lokalt) og deploy igen."
    );
  }

  if (err instanceof MaxTokensError) {
    return (
      `Claude nåede token-loftet før den fik skrevet et svar - modellen "${model}" ` +
      "brugte hele budgettet på at tænke. Prøv igen, eller vælg en anden model under Rådgiver."
    );
  }

  if (err instanceof Anthropic.AuthenticationError) {
    return "Claude afviste ANTHROPIC_API_KEY (401). Nøglen er forkert, udløbet eller tilbagekaldt.";
  }

  if (err instanceof Anthropic.PermissionDeniedError) {
    return `API-nøglen har ikke adgang til modellen "${model}" (403).`;
  }

  if (err instanceof Anthropic.NotFoundError) {
    return `Modellen "${model}" findes ikke (længere). Vælg en anden model under Rådgiver.`;
  }

  if (err instanceof Anthropic.RateLimitError) {
    return "Der er sendt for mange forespørgsler til Claude lige nu (429). Vent et øjeblik og prøv igen.";
  }

  if (err instanceof Anthropic.BadRequestError) {
    // Manglende kredit kommer som en almindelig 400 og er ikke til at skelne
    // fra en reel formatfejl uden at kigge på beskeden.
    if (err.message.toLowerCase().includes("credit balance")) {
      return "Anthropic-kontoen har ikke kredit nok til at kalde Claude. Fyld op på console.anthropic.com under Billing.";
    }
    return `Claude afviste forespørgslen som ugyldig (400) - typisk fordi "${model}" ikke er et gyldigt modelnavn.`;
  }

  if (err instanceof Anthropic.InternalServerError) {
    return "Claude er midlertidigt utilgængelig (serverfejl hos Anthropic). Prøv igen om lidt.";
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return "Kunne ikke få forbindelse til Claude. Tjek netværket og prøv igen.";
  }

  if (err instanceof Error && err.message) {
    return `Claude-kaldet fejlede: ${err.message}`;
  }

  return "Claude-kaldet fejlede af ukendt årsag. Se serverloggen for detaljer.";
}
