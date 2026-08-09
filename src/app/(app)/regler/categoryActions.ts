"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/maaned");
  revalidatePath("/regler");
  revalidatePath("/prognose");
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(HEX_COLOR),
});

export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Angiv et navn og en gyldig farve." };
  }

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (last?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    color: parsed.data.color,
    sort_order: nextSortOrder,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Der findes allerede en kategori med det navn." };
    }
    console.error("createCategory: kunne ikke oprette kategori:", error.code, error.message);
    return { status: "error", message: "Kunne ikke oprette kategorien." };
  }

  revalidateAll();
  return { status: "success" };
}

const updateSchema = categoryInputSchema.extend({ id: z.string().uuid() });

export async function updateCategory(input: {
  id: string;
  name: string;
  color: string;
}): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Angiv et navn og en gyldig farve." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Der findes allerede en kategori med det navn." };
    }
    console.error("updateCategory: kunne ikke gemme kategori:", error.code, error.message);
    return { status: "error", message: "Kunne ikke gemme kategorien." };
  }

  revalidateAll();
  return { status: "success" };
}

const idSchema = z.object({ id: z.string().uuid() });

export async function deleteCategory(
  id: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldigt id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id);

  if (error) {
    console.error("deleteCategory: kunne ikke slette kategori:", error.code, error.message);
    return { status: "error", message: "Kunne ikke slette kategorien." };
  }

  revalidateAll();
  return { status: "success" };
}

const moveSchema = z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) });

export async function moveCategory(
  id: string,
  direction: "up" | "down",
): Promise<{ status: "success" | "error"; message?: string }> {
  const parsed = moveSchema.safeParse({ id, direction });
  if (!parsed.success) {
    return { status: "error", message: "Ugyldige data." };
  }

  const supabase = await createClient();
  const { data: categories, error: fetchError } = await supabase
    .from("categories")
    .select("id, sort_order")
    .order("sort_order");

  if (fetchError || !categories) {
    console.error("moveCategory: kunne ikke hente kategorier:", fetchError?.code, fetchError?.message);
    return { status: "error", message: "Kunne ikke hente kategorierne." };
  }

  const index = categories.findIndex((c) => c.id === parsed.data.id);
  if (index === -1) {
    return { status: "error", message: "Kategorien blev ikke fundet." };
  }

  const swapIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= categories.length) {
    return { status: "success" };
  }

  const current = categories[index];
  const neighbor = categories[swapIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("categories").update({ sort_order: neighbor.sort_order }).eq("id", current.id),
    supabase.from("categories").update({ sort_order: current.sort_order }).eq("id", neighbor.id),
  ]);

  if (err1 || err2) {
    console.error("moveCategory: kunne ikke omarrangere kategorier:", err1 ?? err2);
    return { status: "error", message: "Kunne ikke omarrangere kategorierne." };
  }

  revalidateAll();
  return { status: "success" };
}
