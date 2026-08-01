import Papa from "papaparse";
import { decodeCsvBuffer } from "./decode";
import { parseDanishDate } from "./parseDate";
import { parseDanishAmount } from "./parseAmount";
import { computeRowHash } from "./rowHash";
import type { ParseResult } from "./types";

const EXPECTED_COLUMN_COUNT = 6;

/**
 * Parser rå CSV-tekst (allerede afkodet) fra en Danske Bank-eksport.
 * Kolonner: Dato;Tekst;Beløb;Saldo;Status;Afstemt. Første linje er header
 * og springes over.
 */
export function parseDanskeBankCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text.trim(), {
    delimiter: ";",
    skipEmptyLines: true,
  });

  const rows: ParseResult["rows"] = [];
  const errors: ParseResult["errors"] = [];

  const dataRows = parsed.data.slice(1);

  dataRows.forEach((cols, index) => {
    const rowNumber = index + 2; // 1-indekseret, +1 for header-linjen

    try {
      if (cols.length < EXPECTED_COLUMN_COUNT) {
        throw new Error(
          `Forventede ${EXPECTED_COLUMN_COUNT} kolonner, fandt ${cols.length}`,
        );
      }

      const [dateRaw, textRaw, amountRaw, balanceRaw, status, reconciled] =
        cols;

      const date = parseDanishDate(dateRaw);
      const rawText = (textRaw ?? "").trim();
      const amount = parseDanishAmount(amountRaw ?? "");

      if (amount === null) {
        throw new Error("Beløb mangler");
      }

      const balance = parseDanishAmount(balanceRaw ?? "");
      const rowHash = computeRowHash({ date, rawText, amount, balance });

      rows.push({
        date,
        rawText,
        amount,
        balance,
        status: status?.trim() || null,
        reconciled: reconciled?.trim() || null,
        rowHash,
      });
    } catch (error) {
      errors.push({
        rowNumber,
        message: error instanceof Error ? error.message : String(error),
        raw: cols,
      });
    }
  });

  return { rows, errors };
}

/**
 * Afkoder og parser en uploadet fil i ét trin. Bruges både til preview i
 * browseren og til den faktiske import server-side.
 */
export function parseDanskeBankFile(buffer: ArrayBuffer): ParseResult {
  const text = decodeCsvBuffer(buffer);
  return parseDanskeBankCsv(text);
}
