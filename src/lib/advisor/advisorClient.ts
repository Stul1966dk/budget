import Anthropic from "@anthropic-ai/sdk";

/**
 * Standardmodellen når husstanden ikke selv har valgt en under Rådgiver.
 * Selve valget gemmes i forecast_settings.advisor_model - se
 * resolveAdvisorModel.
 */
export const DEFAULT_ADVISOR_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";

export function resolveAdvisorModel(chosenModel: string | null | undefined): string {
  return chosenModel?.trim() || DEFAULT_ADVISOR_MODEL;
}

export type AvailableModel = { id: string; displayName: string };

/**
 * Henter de modeller API-nøglen faktisk har adgang til, nyeste først (sådan
 * returnerer API'et dem). Listen hentes live, så nye modeller dukker op i
 * vælgeren uden kodeændring.
 */
export async function listAvailableModels(): Promise<AvailableModel[]> {
  const client = createAdvisorClient();
  const models: AvailableModel[] = [];
  for await (const model of client.models.list({ limit: 100 })) {
    models.push({ id: model.id, displayName: model.display_name });
  }
  return models;
}

/**
 * `effort` er kun understøttet af nyere modeller - ældre (fx claude-haiku-4-5)
 * afviser hele kaldet, hvis det sendes med. Spørger derfor API'et om modellens
 * egenskaber, og falder tilbage til et navnetjek hvis det opslag fejler, så
 * et fejlet opslag ikke vælter selve rådgivningen.
 */
export async function modelSupportsMediumEffort(
  client: Anthropic,
  model: string,
): Promise<boolean> {
  try {
    const info = await client.models.retrieve(model);
    const effort = info.capabilities?.effort;
    if (effort) return effort.supported && effort.medium.supported;
  } catch {
    // Falder igennem til navnetjekket nedenfor.
  }
  return !model.includes("haiku");
}

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
