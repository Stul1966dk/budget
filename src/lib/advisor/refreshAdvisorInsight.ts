import { createClient } from "@/lib/supabase/server";
import { buildBudgetSnapshot } from "./buildBudgetSnapshot";
import { generateAdvice } from "./generateAdvice";
import { describeAdvisorError } from "./describeAdvisorError";

export type AdvisorRefreshResult =
  | { status: "success"; content: string }
  | { status: "error"; message: string };

/**
 * Genberegner forecast/trends ud fra alle posteringer, beder Claude om en
 * kort anbefaling, og gemmer resultatet. Fejler aldrig hårdt - kaldes både
 * automatisk efter upload og manuelt fra rådgiver-siden, og skal ikke kunne
 * vælte hverken import eller sidevisning.
 *
 * Returnerer en konkret fejlbesked frem for bare `null`, så rådgiver-siden kan
 * vise hvad der rent faktisk gik galt - manglende data, et afvist API-kald
 * eller en fejlet skrivning er tre helt forskellige problemer at rette.
 */
export async function refreshAdvisorInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AdvisorRefreshResult> {
  const snapshot = await buildBudgetSnapshot(supabase);
  if (!snapshot) {
    return {
      status: "error",
      message: "Der er ingen budgetdata at give en anbefaling ud fra endnu. Upload en CSV først.",
    };
  }

  let content: string;
  try {
    content = await generateAdvice(snapshot);
  } catch (err) {
    console.error("refreshAdvisorInsight: kunne ikke generere anbefaling:", err);
    return { status: "error", message: describeAdvisorError(err, snapshot.advisorModel) };
  }

  const { error } = await supabase.from("advisor_insights").insert({
    content,
    model: snapshot.advisorModel,
  });

  if (error) {
    console.error(
      "refreshAdvisorInsight: kunne ikke gemme anbefaling:",
      error.code,
      error.message,
    );
    return {
      status: "error",
      message: "Anbefalingen blev genereret, men kunne ikke gemmes i databasen.",
    };
  }

  return { status: "success", content };
}
