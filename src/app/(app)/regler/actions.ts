"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  id: z.string().uuid(),
  matchPattern: z.string().trim().min(1).max(200),
  matchType: z.enum(["prefix", "contains", "exact"]),
  comment: z.string().trim().max(500).nullable(),
  categoryId: z.string().uuid().nullable(),
  minAmount: z.number().nonnegative().nullable(),
  maxAmount: z.number().nonnegative().nullable(),
});

export type UpdateMappingRuleInput = z.infer<typeof updateSchema>;

export async function updateMappingRule(
  input: UpdateMappingRuleInput,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Ugyldige data." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("text_mappings")
    .update({
      match_pattern: data.matchPattern,
      match_type: data.matchType,
      comment: data.comment,
      category_id: data.categoryId,
      min_amount: data.minAmount,
      max_amount: data.maxAmount,
    })
    .eq("id", data.id);

  if (error) {
    return { status: "error", message: "Kunne ikke gemme reglen." };
  }

  // Slå navn/kategori igennem på alle posteringer der allerede er tildelt
  // denne regel, så en omdøbning vises konsekvent overalt med det samme -
  // ikke kun på nye posteringer der importeres fremover.
  const { error: cascadeError } = await supabase
    .from("transactions")
    .update({ comment: data.comment, category_id: data.categoryId })
    .eq("mapping_id", data.id);

  if (cascadeError) {
    console.error(
      "updateMappingRule: kunne ikke opdatere eksisterende posteringer:",
      cascadeError.code,
      cascadeError.message,
    );
  }

  revalidatePath("/");
  revalidatePath("/regler");
  revalidatePath("/aar");
  revalidatePath("/prognose");
  return { status: "success" };
}

const setActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export async function setMappingRuleActive(
  id: string,
  active: boolean,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = setActiveSchema.safeParse({ id, active });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldige data." };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("text_mappings")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: "Kunne ikke opdatere reglen." };
  }

  revalidatePath("/regler");
  revalidatePath("/prognose");
  return { status: "success" };
}

export async function deleteMappingRule(
  id: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("text_mappings").delete().eq("id", id);

  if (error) {
    return { status: "error", message: "Kunne ikke slette reglen." };
  }

  revalidatePath("/regler");
  return { status: "success" };
}
