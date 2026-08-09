"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { refreshAdvisorInsight } from "@/lib/advisor/refreshAdvisorInsight";
import { buildBudgetSnapshot } from "@/lib/advisor/buildBudgetSnapshot";
import { chatWithAdvisor, type ChatMessage } from "@/lib/advisor/chatWithAdvisor";

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

const advisorNotesSchema = z.object({ notes: z.string().trim().max(2000).nullable() });

export async function updateAdvisorNotes(
  notes: string | null,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = advisorNotesSchema.safeParse({ notes });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldig tekst." };
  }
  const value = parsed.data.notes?.length ? parsed.data.notes : null;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("forecast_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("forecast_settings")
        .update({ advisor_notes: value, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase.from("forecast_settings").insert({ advisor_notes: value });

  if (error) {
    console.error("updateAdvisorNotes: kunne ikke gemme noten:", error.code, error.message);
    return { status: "error", message: "Kunne ikke gemme noten." };
  }

  revalidatePath("/prognose");
  return { status: "success" };
}

const askAdvisorSchema = z.object({ question: z.string().trim().min(1).max(2000) });

export async function askAdvisor(
  question: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = askAdvisorSchema.safeParse({ question });
  if (!parsed.success) {
    return { status: "error", message: "Skriv et spørgsmål." };
  }

  const supabase = await createClient();

  const snapshot = await buildBudgetSnapshot(supabase);
  if (!snapshot) {
    return { status: "error", message: "Ingen budgetdata endnu til at svare ud fra." };
  }

  const { data: messageRows } = await supabase
    .from("advisor_messages")
    .select("role, content")
    .order("created_at");

  const history: ChatMessage[] = (messageRows ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: parsed.data.question });

  // Spørgsmål og svar gemmes først, når vi rent faktisk har et svar - ellers
  // ville et fejlet API-kald efterlade et ubesvaret spørgsmål i historikken,
  // der forvirrer både visningen og næste besked til AI'en.
  let answer: string;
  try {
    answer = await chatWithAdvisor(snapshot, history);
  } catch (err) {
    console.error("askAdvisor: kunne ikke generere svar:", err);
    return {
      status: "error",
      message: "Kunne ikke generere et svar. Tjek at ANTHROPIC_API_KEY er sat, og prøv igen.",
    };
  }

  const { error: insertError } = await supabase.from("advisor_messages").insert([
    { role: "user", content: parsed.data.question },
    { role: "assistant", content: answer },
  ]);

  if (insertError) {
    console.error(
      "askAdvisor: kunne ikke gemme samtalen:",
      insertError.code,
      insertError.message,
    );
    return { status: "error", message: "Kunne ikke gemme samtalen." };
  }

  revalidatePath("/prognose");
  return { status: "success" };
}

export async function clearAdvisorChat(): Promise<{
  status: "success" | "error";
  message?: string;
}> {
  const supabase = await createClient();
  const { error } = await supabase.from("advisor_messages").delete().not("id", "is", null);

  if (error) {
    console.error("clearAdvisorChat: kunne ikke rydde samtalen:", error.code, error.message);
    return { status: "error", message: "Kunne ikke rydde samtalen." };
  }

  revalidatePath("/prognose");
  return { status: "success" };
}
