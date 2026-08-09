import { createClient } from "@/lib/supabase/server";
import { buildBudgetSnapshot } from "./buildBudgetSnapshot";
import { ADVISOR_MODEL, generateAdvice } from "./generateAdvice";

/**
 * Genberegner forecast/trends ud fra alle posteringer, beder Claude om en
 * kort anbefaling, og gemmer resultatet. Fejler aldrig hårdt - kaldes både
 * automatisk efter upload og manuelt fra rådgiver-siden, og skal ikke kunne
 * vælte hverken import eller sidevisning.
 */
export async function refreshAdvisorInsight(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const snapshot = await buildBudgetSnapshot(supabase);
  if (!snapshot) return null;

  try {
    const content = await generateAdvice(snapshot);

    const { error } = await supabase.from("advisor_insights").insert({
      content,
      model: ADVISOR_MODEL,
    });

    if (error) {
      console.error(
        "refreshAdvisorInsight: kunne ikke gemme anbefaling:",
        error.code,
        error.message,
      );
      return null;
    }

    return content;
  } catch (err) {
    console.error("refreshAdvisorInsight: kunne ikke generere anbefaling:", err);
    return null;
  }
}
