import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { describeAdvisorError } from "./describeAdvisorError";
import { MaxTokensError, MissingApiKeyError } from "./advisorClient";

/**
 * Bygger fejlen præcis som SDK'et selv gør det ud fra et HTTP-svar - både
 * hvilken fejlklasse der vælges ud fra statuskoden, og at det er den rå body
 * (ikke et separat message-argument) der ender i `err.message`. Testene ville
 * ellers ramme andre grene end de rigtige gør i produktion.
 */
function apiError(status: number, message: string) {
  return Anthropic.APIError.generate(
    status,
    { type: "error", error: { type: "invalid_request_error", message } },
    undefined,
    new Headers(),
  );
}

describe("describeAdvisorError", () => {
  it("peger på miljøvariablen når nøglen slet ikke er sat", () => {
    const message = describeAdvisorError(new MissingApiKeyError());

    expect(message).toContain("ANTHROPIC_API_KEY er ikke sat");
    expect(message).toContain("Environment Variables");
  });

  it("peger på token-loftet frem for nøglen når svaret blev klippet af", () => {
    const message = describeAdvisorError(new MaxTokensError());

    expect(message).toContain("token-loftet");
    expect(message).toContain("anden model");
    expect(message).not.toContain("ANTHROPIC_API_KEY");
  });

  it("skelner en afvist nøgle fra en manglende nøgle", () => {
    const message = describeAdvisorError(apiError(401, "invalid x-api-key"));

    expect(message).toContain("afviste");
    expect(message).not.toContain("er ikke sat");
  });

  it("fortæller når kontoen mangler kredit", () => {
    const message = describeAdvisorError(apiError(400, "Your credit balance is too low"));

    expect(message).toContain("kredit");
  });

  it("peger på modelnavnet ved andre 400-fejl", () => {
    const message = describeAdvisorError(apiError(400, "model: unknown field"));

    expect(message).toContain("modelnavn");
  });

  it("videregiver beskeden fra almindelige fejl", () => {
    const message = describeAdvisorError(new Error("Intet tekstsvar fra Claude."));

    expect(message).toContain("Intet tekstsvar fra Claude.");
  });

  it("falder tilbage til en generisk besked for ukendte værdier", () => {
    expect(describeAdvisorError("noget mærkeligt")).toContain("ukendt årsag");
  });
});
