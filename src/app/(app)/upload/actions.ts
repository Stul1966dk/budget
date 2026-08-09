"use server";

import { createClient } from "@/lib/supabase/server";
import { parseDanskeBankFile } from "@/lib/csv/parseDanskeBank";
import { findBestMatchingRule } from "@/lib/mapping/findBestMatch";
import {
  detectMissingRecurring,
  detectPriceIncreases,
  detectUnusualAmounts,
} from "@/lib/alerts/detectAnomalies";
import { composeAlertMessage } from "@/lib/alerts/composeAlertMessage";
import { refreshAdvisorInsight } from "@/lib/advisor/refreshAdvisorInsight";
import type { TextMappingRow, TransactionRow } from "@/lib/types/db";

export type ImportResult = {
  status: "success" | "error";
  message?: string;
  rowsImported?: number;
  rowsSkipped?: number;
  parseErrors?: { rowNumber: number; message: string }[];
  alertMessages?: string[];
};

export async function importCsvFile(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Ingen fil modtaget." };
  }

  const buffer = await file.arrayBuffer();
  const { rows, errors } = parseDanskeBankFile(buffer);

  // Samme fil (eller overlappende perioder) kan uploades flere gange - fjern
  // evt. dubletter internt i selve filen, før vi tjekker mod databasen.
  const uniqueRows = Array.from(
    new Map(rows.map((row) => [row.rowHash, row])).values(),
  );

  const supabase = await createClient();

  const hashes = uniqueRows.map((row) => row.rowHash);
  const { data: existing, error: existingError } = hashes.length
    ? await supabase.from("transactions").select("row_hash").in("row_hash", hashes)
    : { data: [], error: null };

  if (existingError) {
    console.error(
      "importCsvFile: kunne ikke tjekke dubletter:",
      existingError.code,
      existingError.message,
    );
    return {
      status: "error",
      message: "Kunne ikke tjekke for dubletter i databasen.",
    };
  }

  const existingHashes = new Set((existing ?? []).map((r) => r.row_hash));
  const newRows = uniqueRows.filter((row) => !existingHashes.has(row.rowHash));
  const rowsSkipped = rows.length - newRows.length;

  const { data: mappingsData, error: mappingsError } = await supabase
    .from("text_mappings")
    .select(
      "id, match_pattern, match_type, comment, category_id, min_amount, max_amount, display_mode, active",
    );

  if (mappingsError) {
    console.error(
      "importCsvFile: kunne ikke hente mapping-regler:",
      mappingsError.code,
      mappingsError.message,
    );
    return { status: "error", message: "Kunne ikke hente mapping-regler." };
  }

  const mappingRules = ((mappingsData ?? []) as TextMappingRow[]).map((m) => ({
    id: m.id,
    matchPattern: m.match_pattern,
    matchType: m.match_type,
    comment: m.comment,
    categoryId: m.category_id,
    minAmount: m.min_amount,
    maxAmount: m.max_amount,
    displayMode: m.display_mode,
  }));

  const discontinuedMappingIds = new Set(
    ((mappingsData ?? []) as TextMappingRow[])
      .filter((m) => !m.active)
      .map((m) => m.id),
  );

  const toInsert = newRows.map((row) => {
    const bestRule = findBestMatchingRule(
      { rawText: row.rawText, amount: row.amount },
      mappingRules,
    );
    return {
      date: row.date,
      raw_text: row.rawText,
      amount: row.amount,
      balance: row.balance,
      status: row.status,
      reconciled: row.reconciled,
      row_hash: row.rowHash,
      comment: bestRule?.displayMode === "grouped" ? bestRule.comment : null,
      category_id: bestRule?.categoryId ?? null,
      mapping_id: bestRule?.id ?? null,
      is_extraordinary: false,
    };
  });

  let insertedRows: TransactionRow[] = [];

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .insert(toInsert)
      .select("*");

    if (insertError) {
      console.error(
        "importCsvFile: kunne ikke gemme posteringerne:",
        insertError.code,
        insertError.message,
      );
      return { status: "error", message: "Kunne ikke gemme posteringerne." };
    }

    insertedRows = (inserted ?? []) as TransactionRow[];
  }

  await supabase.from("uploads").insert({
    filename: file.name,
    rows_imported: toInsert.length,
    rows_skipped: rowsSkipped,
  });

  const alertMessages = await detectAndSaveAlerts(
    supabase,
    insertedRows,
    mappingRules,
    discontinuedMappingIds,
  );

  if (insertedRows.length > 0) {
    // Fejler stille - en ny anbefaling er en bonus, ikke en forudsætning for
    // at importen skal tælle som gennemført.
    await refreshAdvisorInsight(supabase);
  }

  return {
    status: "success",
    rowsImported: toInsert.length,
    rowsSkipped,
    parseErrors: errors.map((e) => ({
      rowNumber: e.rowNumber,
      message: e.message,
    })),
    alertMessages,
  };
}

async function detectAndSaveAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  insertedRows: TransactionRow[],
  mappingRules: { id: string; matchPattern: string; comment: string | null }[],
  discontinuedMappingIds: Set<string>,
): Promise<string[]> {
  if (insertedRows.length === 0) return [];

  const { data: allTransactionsData, error: allTransactionsError } = await supabase
    .from("transactions")
    .select("*")
    .order("date");

  if (allTransactionsError) {
    console.error(
      "importCsvFile: kunne ikke hente posteringer til alert-tjek:",
      allTransactionsError.code,
      allTransactionsError.message,
    );
    return [];
  }

  const allTransactions = (allTransactionsData ?? []) as TransactionRow[];
  const mappingLabels = new Map(
    mappingRules.map((m) => [m.id, m.comment ?? m.matchPattern]),
  );

  const detected = [
    ...detectPriceIncreases(insertedRows, allTransactions),
    ...detectUnusualAmounts(insertedRows, allTransactions),
    ...detectMissingRecurring(
      insertedRows,
      allTransactions,
      mappingLabels,
      discontinuedMappingIds,
    ),
  ];

  if (detected.length === 0) return [];

  const missingRecurring = detected.filter((a) => a.type === "missing_recurring");
  let toInsertAlerts = detected;

  if (missingRecurring.length > 0) {
    const { data: existingAlerts } = await supabase
      .from("alerts")
      .select("mapping_id, month_key")
      .eq("type", "missing_recurring");

    const existingKeys = new Set(
      (existingAlerts ?? []).map((a) => `${a.mapping_id}:${a.month_key}`),
    );

    toInsertAlerts = detected.filter(
      (a) =>
        a.type !== "missing_recurring" ||
        !existingKeys.has(`${a.mapping_id}:${a.month_key}`),
    );
  }

  if (toInsertAlerts.length === 0) return [];

  const { error: alertsError } = await supabase.from("alerts").insert(toInsertAlerts);

  if (alertsError) {
    console.error(
      "importCsvFile: kunne ikke gemme alerts:",
      alertsError.code,
      alertsError.message,
    );
    return [];
  }

  return toInsertAlerts.map(composeAlertMessage);
}
