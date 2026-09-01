import Anthropic from "@anthropic-ai/sdk";

export const ADVISOR_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * Tænkende modeller (fx claude-opus-5) bruger thinking-tokens af det SAMME
 * budget som selve svaret. Med det gamle loft på 1024 kunne tænkningen æde
 * hele budgettet, så svaret blev klippet af inden der overhovedet kom en
 * tekstblok - og kaldet fejlede med "Intet tekstsvar fra Claude." Selve
 * anbefalingen fylder kun 250-650 tokens, så resten er hovedrum til
 * tænkningen, ikke et længere svar.
 */
export const ADVISOR_MAX_TOKENS = 4096;

/**
 * Kastes når ANTHROPIC_API_KEY mangler i miljøet. SDK'et fejler ellers først
 * ude i selve API-kaldet med en generisk 401, hvilket ikke kan skelnes fra en
 * forkert nøgle - og netop den forskel er den, man har brug for at kende.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY er ikke sat i miljøet.");
    this.name = "MissingApiKeyError";
  }
}

/**
 * Kastes når svaret ramte token-loftet uden at nå frem til en tekstblok.
 * Egen fejltype, fordi rettelsen er en helt anden end ved de øvrige fejl -
 * her er hverken nøgle, model eller netværk galt.
 */
export class MaxTokensError extends Error {
  constructor() {
    super(`Svaret ramte token-loftet (${ADVISOR_MAX_TOKENS}) uden at nå frem til en tekst.`);
    this.name = "MaxTokensError";
  }
}

export function createAdvisorClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();

  return new Anthropic({ apiKey });
}
