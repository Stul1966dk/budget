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
  displayMode: z.enum(["grouped", "individual"]),
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

  const { data: existingRule } = await supabase
    .from("text_mappings")
    .select("comment")
    .eq("id", data.id)
    .single();
  const previousComment = existingRule?.comment ?? null;

  const { error } = await supabase
    .from("text_mappings")
    .update({
      match_pattern: data.matchPattern,
      match_type: data.matchType,
      comment: data.comment,
      category_id: data.categoryId,
      min_amount: data.minAmount,
      max_amount: data.maxAmount,
      display_mode: data.displayMode,
    })
    .eq("id", data.id);

  if (error) {
    return { status: "error", message: "Kunne ikke gemme reglen." };
  }

  // Slå kategori igennem på alle posteringer der allerede er tildelt denne
  // regel, så en ændring vises konsekvent overalt med det samme - ikke kun på
  // nye posteringer der importeres fremover. Kommentaren cascades kun når
  // reglen samler til én post - ellers ville det overskrive evt. individuelle
  // navne man har givet enkelte posteringer under "Vis hver for sig".
  const { error: cascadeError } = await supabase
    .from("transactions")
    .update(
      data.displayMode === "grouped"
        ? { comment: data.comment, category_id: data.categoryId }
        : { category_id: data.categoryId },
    )
    .eq("mapping_id", data.id);

  if (cascadeError) {
    console.error(
      "updateMappingRule: kunne ikke opdatere eksisterende posteringer:",
      cascadeError.code,
      cascadeError.message,
    );
  }

  // Skifter reglen til "vis hver for sig", skal den tidligere fælles
  // kommentar ryddes - ellers deler posteringerne stadig samme tekst og
  // bliver stadig vist som én post. Kun posteringer der endnu har reglens
  // tidligere kommentar rammes - en postering man selv har givet et andet,
  // individuelt navn, bliver ikke rørt.
  if (data.displayMode === "individual" && previousComment !== null) {
    const { error: clearError } = await supabase
      .from("transactions")
      .update({ comment: null })
      .eq("mapping_id", data.id)
      .eq("comment", previousComment);

    if (clearError) {
      console.error(
        "updateMappingRule: kunne ikke rydde tidligere fælles kommentar:",
        clearError.code,
        clearError.message,
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/maaned");
  revalidatePath("/regler");
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
