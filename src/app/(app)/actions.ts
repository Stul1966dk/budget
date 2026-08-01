"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { findRetroactiveMatches } from "@/lib/mapping/applyRule";
import type { MappableTransaction, MappingRule } from "@/lib/mapping/types";

const editSchema = z.object({
  id: z.string().uuid(),
  comment: z.string().trim().max(500).nullable(),
  categoryId: z.string().uuid().nullable(),
  isExtraordinary: z.boolean(),
  createRule: z.boolean(),
  matchPattern: z.string().trim().min(1).max(200).optional(),
  matchType: z.enum(["prefix", "contains", "exact"]).optional(),
});

export type SaveTransactionEditInput = z.infer<typeof editSchema>;

export type SaveTransactionEditResult =
  | { status: "error"; message: string }
  | {
      status: "success";
      newRule?: { id: string; matchCount: number; pattern: string };
    };

async function fetchUnmappedCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  excludeId?: string,
): Promise<MappableTransaction[]> {
  let query = supabase
    .from("transactions")
    .select("id, raw_text, comment, category_id, mapping_id")
    .is("comment", null)
    .is("category_id", null)
    .is("mapping_id", null);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;

  return (data ?? []).map((t) => ({
    id: t.id,
    rawText: t.raw_text,
    comment: t.comment,
    categoryId: t.category_id,
    mappingId: t.mapping_id,
  }));
}

export async function saveTransactionEdit(
  input: SaveTransactionEditInput,
): Promise<SaveTransactionEditResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Ugyldige data." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      comment: data.comment?.length ? data.comment : null,
      category_id: data.categoryId,
      is_extraordinary: data.isExtraordinary,
    })
    .eq("id", data.id);

  if (updateError) {
    return { status: "error", message: "Kunne ikke gemme ændringen." };
  }

  let newRule: { id: string; matchCount: number; pattern: string } | undefined;

  if (data.createRule && data.matchPattern) {
    const ruleComment = data.comment?.length ? data.comment : null;

    const { data: ruleRow, error: ruleError } = await supabase
      .from("text_mappings")
      .insert({
        match_pattern: data.matchPattern,
        match_type: data.matchType ?? "prefix",
        comment: ruleComment,
        category_id: data.categoryId,
      })
      .select("id")
      .single();

    if (!ruleError && ruleRow) {
      // Posteringen der udløste reglen skal selv have mapping_id sat - ellers
      // tæller den aldrig med som "genkendt" i alerts, prognose eller
      // årsoversigt, selvom dens kommentar/kategori allerede matcher reglen.
      await supabase
        .from("transactions")
        .update({ mapping_id: ruleRow.id })
        .eq("id", data.id);

      const candidates = await fetchUnmappedCandidates(supabase, data.id);
      const rule: MappingRule = {
        id: ruleRow.id,
        matchPattern: data.matchPattern,
        matchType: data.matchType ?? "prefix",
        comment: ruleComment,
        categoryId: data.categoryId,
      };
      const matches = findRetroactiveMatches(rule, candidates);
      newRule = {
        id: ruleRow.id,
        matchCount: matches.length,
        pattern: data.matchPattern,
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/regler");
  return { status: "success", newRule };
}

const acknowledgeAlertSchema = z.object({ id: z.string().uuid() });

export async function acknowledgeAlert(
  id: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = acknowledgeAlertSchema.safeParse({ id });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldigt id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ acknowledged: true })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("acknowledgeAlert: kunne ikke opdatere alert:", error.code, error.message);
    return { status: "error", message: "Kunne ikke markere som set." };
  }

  revalidatePath("/");
  return { status: "success" };
}

export async function applyRuleRetroactively(ruleId: string): Promise<{
  status: "success" | "error";
  updated?: number;
  message?: string;
}> {
  const supabase = await createClient();

  const { data: ruleRow, error: ruleError } = await supabase
    .from("text_mappings")
    .select("id, match_pattern, match_type, comment, category_id")
    .eq("id", ruleId)
    .single();

  if (ruleError || !ruleRow) {
    return { status: "error", message: "Reglen blev ikke fundet." };
  }

  const rule: MappingRule = {
    id: ruleRow.id,
    matchPattern: ruleRow.match_pattern,
    matchType: ruleRow.match_type,
    comment: ruleRow.comment,
    categoryId: ruleRow.category_id,
  };

  const candidates = await fetchUnmappedCandidates(supabase);
  const matches = findRetroactiveMatches(rule, candidates);

  await Promise.all(
    matches.map((t) =>
      supabase
        .from("transactions")
        .update({
          comment: rule.comment,
          category_id: rule.categoryId,
          mapping_id: rule.id,
        })
        .eq("id", t.id),
    ),
  );

  revalidatePath("/");
  revalidatePath("/regler");

  return { status: "success", updated: matches.length };
}
