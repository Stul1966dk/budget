"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildBudgetFromForecast, type DraftBudgetLine } from "@/lib/budget/buildBudgetFromForecast";
import { computeBudgetTotals } from "@/lib/budget/computeBudgetTotals";
import type {
  BudgetLineRow,
  TextMappingRow,
  TransactionRow,
} from "@/lib/types/db";

type ActionError = { status: "error"; message: string };
type ActionResult = { status: "success" } | ActionError;

const yearSchema = z.number().int().min(2000).max(2100);
const amountSchema = z.number().finite().min(0).max(100_000_000);
const amountsSchema = z.array(amountSchema).length(12);

function roundAmounts(amounts: number[]): number[] {
  return amounts.map((a) => Math.round(a * 100) / 100);
}

// ---------------------------------------------------------------------------
// Opret budget
// ---------------------------------------------------------------------------

const createBudgetSchema = z.discriminatedUnion("source", [
  z.object({ year: yearSchema, source: z.literal("forecast") }),
  z.object({ year: yearSchema, source: z.literal("empty") }),
  z.object({ year: yearSchema, source: z.literal("budget"), sourceYear: yearSchema }),
]);

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export async function createBudget(input: CreateBudgetInput): Promise<ActionResult> {
  const parsed = createBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Ugyldigt valg." };
  }
  const { year } = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("year", year)
    .maybeSingle();
  if (existing) {
    return { status: "error", message: `Der findes allerede et budget for ${year}.` };
  }

  let lines: DraftBudgetLine[] = [];
  let startBalance: number | null = null;

  if (parsed.data.source === "forecast") {
    const [{ data: txData, error: txError }, { data: mapData }, { data: settings }] =
      await Promise.all([
        supabase.from("transactions").select("*").order("date"),
        supabase
          .from("text_mappings")
          .select("id, comment, match_pattern, category_id, active"),
        supabase
          .from("forecast_settings")
          .select("monthly_income_override")
          .limit(1)
          .maybeSingle(),
      ]);
    if (txError) {
      console.error("createBudget: kunne ikke hente posteringer:", txError.code, txError.message);
      return { status: "error", message: "Kunne ikke hente prognosen." };
    }
    const draft = buildBudgetFromForecast(
      (txData ?? []) as TransactionRow[],
      (mapData ?? []) as Pick<
        TextMappingRow,
        "id" | "comment" | "match_pattern" | "category_id" | "active"
      >[],
      (settings?.monthly_income_override as number | null | undefined) ?? null,
      year,
    );
    lines = draft.lines;
    startBalance = draft.startBalance;
  } else if (parsed.data.source === "budget") {
    const { data: source } = await supabase
      .from("budgets")
      .select("id, start_balance")
      .eq("year", parsed.data.sourceYear)
      .maybeSingle();
    if (!source) {
      return { status: "error", message: "Budgettet der skulle kopieres findes ikke." };
    }
    const { data: sourceLines } = await supabase
      .from("budget_lines")
      .select("kind, label, category_id, mapping_ids, include_category, amounts, sort_order")
      .eq("budget_id", source.id)
      .order("sort_order");
    lines = ((sourceLines ?? []) as BudgetLineRow[]).map((l) => ({
      kind: l.kind,
      label: l.label,
      categoryId: l.category_id,
      mappingIds: l.mapping_ids ?? [],
      includeCategory: l.include_category ?? false,
      amounts: l.amounts.map(Number),
    }));
    // Næste års startsaldo = kildebudgettets forventede slutsaldo, men kun
    // når kildebudgettet ligger lige før - ellers giver det ingen mening.
    if (source.start_balance !== null && parsed.data.sourceYear === year - 1) {
      startBalance = computeBudgetTotals(lines, Number(source.start_balance)).balances[11];
    }
  }

  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({ year, start_balance: startBalance })
    .select("id")
    .single();
  if (budgetError || !budget) {
    console.error("createBudget: kunne ikke oprette budget:", budgetError?.code, budgetError?.message);
    return { status: "error", message: "Kunne ikke oprette budgettet." };
  }

  if (lines.length > 0) {
    const { error: linesError } = await supabase.from("budget_lines").insert(
      lines.map((l, i) => ({
        budget_id: budget.id,
        kind: l.kind,
        label: l.label,
        category_id: l.categoryId,
        mapping_ids: l.mappingIds,
        include_category: l.includeCategory,
        amounts: roundAmounts(l.amounts),
        sort_order: i,
      })),
    );
    if (linesError) {
      console.error("createBudget: kunne ikke oprette linjer:", linesError.code, linesError.message);
      // Ryd op, så der ikke ligger et halvt budget og blokerer året.
      await supabase.from("budgets").delete().eq("id", budget.id);
      return { status: "error", message: "Kunne ikke oprette budgettets poster." };
    }
  }

  revalidatePath("/budget");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Slet budget
// ---------------------------------------------------------------------------

export async function deleteBudget(budgetId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(budgetId);
  if (!parsed.success) return { status: "error", message: "Ugyldigt budget." };

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", parsed.data);
  if (error) {
    console.error("deleteBudget:", error.code, error.message);
    return { status: "error", message: "Kunne ikke slette budgettet." };
  }

  revalidatePath("/budget");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Startsaldo
// ---------------------------------------------------------------------------

const startBalanceSchema = z.object({
  budgetId: z.uuid(),
  value: z.number().finite().min(-100_000_000).max(100_000_000).nullable(),
});

export async function updateBudgetStartBalance(
  budgetId: string,
  value: number | null,
): Promise<ActionResult> {
  const parsed = startBalanceSchema.safeParse({ budgetId, value });
  if (!parsed.success) return { status: "error", message: "Ugyldigt beløb." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({
      start_balance:
        parsed.data.value === null ? null : Math.round(parsed.data.value * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.budgetId);
  if (error) {
    console.error("updateBudgetStartBalance:", error.code, error.message);
    return { status: "error", message: "Kunne ikke gemme startsaldoen." };
  }

  revalidatePath("/budget");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Linjer
// ---------------------------------------------------------------------------

const lineFieldsSchema = z.object({
  kind: z.enum(["income", "expense"]),
  label: z.string().trim().min(1).max(200),
  categoryId: z.uuid().nullable(),
  amounts: amountsSchema,
  mappingIds: z.array(z.uuid()).max(500),
  includeCategory: z.boolean(),
});

const saveLineSchema = z.discriminatedUnion("mode", [
  lineFieldsSchema.extend({ mode: z.literal("create"), budgetId: z.uuid() }),
  lineFieldsSchema.extend({ mode: z.literal("update"), lineId: z.uuid() }),
]);

export type SaveBudgetLineInput = z.infer<typeof saveLineSchema>;

/** Opretter eller opdaterer en hel linje (navn, type, kategori og beløb). */
export async function saveBudgetLine(
  input: SaveBudgetLineInput,
): Promise<{ status: "success"; line: BudgetLineRow } | ActionError> {
  const parsed = saveLineSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Ugyldige oplysninger." };
  const data = parsed.data;

  const fields = {
    kind: data.kind,
    label: data.label,
    category_id: data.categoryId,
    amounts: roundAmounts(data.amounts),
    mapping_ids: Array.from(new Set(data.mappingIds)),
    // Uden kategori er der ikke noget at koble på.
    include_category: data.includeCategory && data.categoryId !== null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  let result;
  if (data.mode === "create") {
    const { data: last } = await supabase
      .from("budget_lines")
      .select("sort_order")
      .eq("budget_id", data.budgetId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    result = await supabase
      .from("budget_lines")
      .insert({ ...fields, budget_id: data.budgetId, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("*")
      .single();
  } else {
    result = await supabase
      .from("budget_lines")
      .update(fields)
      .eq("id", data.lineId)
      .select("*")
      .single();
  }

  if (result.error || !result.data) {
    console.error("saveBudgetLine:", result.error?.code, result.error?.message);
    return { status: "error", message: "Kunne ikke gemme posten." };
  }

  revalidatePath("/budget");
  return { status: "success", line: normalizeLine(result.data as BudgetLineRow) };
}

const amountsUpdateSchema = z.object({ lineId: z.uuid(), amounts: amountsSchema });

/** Gemmer kun beløbene på en linje - bruges når et enkelt felt i tabellen rettes. */
export async function updateBudgetLineAmounts(
  lineId: string,
  amounts: number[],
): Promise<ActionResult> {
  const parsed = amountsUpdateSchema.safeParse({ lineId, amounts });
  if (!parsed.success) return { status: "error", message: "Ugyldigt beløb." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_lines")
    .update({
      amounts: roundAmounts(parsed.data.amounts),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.lineId);
  if (error) {
    console.error("updateBudgetLineAmounts:", error.code, error.message);
    return { status: "error", message: "Kunne ikke gemme beløbet." };
  }

  revalidatePath("/budget");
  return { status: "success" };
}

export async function deleteBudgetLine(lineId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(lineId);
  if (!parsed.success) return { status: "error", message: "Ugyldig post." };

  const supabase = await createClient();
  const { error } = await supabase.from("budget_lines").delete().eq("id", parsed.data);
  if (error) {
    console.error("deleteBudgetLine:", error.code, error.message);
    return { status: "error", message: "Kunne ikke slette posten." };
  }

  revalidatePath("/budget");
  return { status: "success" };
}

/** numeric-kolonner kan komme retur som strenge - gør dem til tal. */
function normalizeLine(line: BudgetLineRow): BudgetLineRow {
  return { ...line, amounts: line.amounts.map(Number) };
}
