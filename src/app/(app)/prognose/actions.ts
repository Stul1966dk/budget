"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { refreshAdvisorInsight } from "@/lib/advisor/refreshAdvisorInsight";

export async function regenerateAdvice(): Promise<{
  status: "success" | "error";
  message?: string;
}> {
  const supabase = await createClient();
  const content = await refreshAdvisorInsight(supabase);

  if (!content) {
    return {
      status: "error",
      message:
        "Kunne ikke generere en ny anbefaling. Tjek at ANTHROPIC_API_KEY er sat, og prøv igen.",
    };
  }

  revalidatePath("/prognose");
  return { status: "success" };
}

const incomeOverrideSchema = z.object({ value: z.number().min(0).nullable() });

export async function updateMonthlyIncomeOverride(
  value: number | null,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = incomeOverrideSchema.safeParse({ value });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldigt beløb." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("forecast_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("forecast_settings")
        .update({
          monthly_income_override: parsed.data.value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    : await supabase
        .from("forecast_settings")
        .insert({ monthly_income_override: parsed.data.value });

  if (error) {
    console.error(
      "updateMonthlyIncomeOverride: kunne ikke gemme beløbet:",
      error.code,
      error.message,
    );
    return { status: "error", message: "Kunne ikke gemme beløbet." };
  }

  revalidatePath("/prognose");
  return { status: "success" };
}
