import type { TransactionRow } from "@/lib/types/db";
import { extractMonthKey, shiftMonthKey } from "@/lib/month";

export type AlertType = "price_increase" | "missing_recurring" | "unusual_amount";

export type DetectedAlert = {
  type: AlertType;
  label: string;
  transaction_id: string | null;
  mapping_id: string | null;
  previous_amount: number | null;
  new_amount: number | null;
  month_key: string;
  typical_day: number | null;
};

/**
 * Flager posteringer knyttet til en mapping-regel der er steget mere end
 * 2% (og mindst 1 kr.) i forhold til den seneste tidligere postering med
 * samme regel.
 */
export function detectPriceIncreases(
  newTransactions: TransactionRow[],
  allTransactions: TransactionRow[],
): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];

  for (const t of newTransactions) {
    if (t.mapping_id === null || t.amount >= 0 || t.is_extraordinary) continue;

    const priorMatches = allTransactions.filter(
      (o) =>
        o.mapping_id === t.mapping_id &&
        o.id !== t.id &&
        o.date < t.date &&
        !o.is_extraordinary,
    );
    if (priorMatches.length === 0) continue;

    const previous = priorMatches.reduce((latest, o) =>
      o.date > latest.date ? o : latest,
    );

    const increaseThreshold = Math.max(1, Math.abs(previous.amount) * 0.02);
    if (Math.abs(t.amount) - Math.abs(previous.amount) <= increaseThreshold) continue;

    alerts.push({
      type: "price_increase",
      label: t.comment ?? t.raw_text,
      transaction_id: t.id,
      mapping_id: t.mapping_id,
      previous_amount: previous.amount,
      new_amount: t.amount,
      month_key: extractMonthKey(t.date),
      typical_day: null,
    });
  }

  return alerts;
}

/**
 * Flager nye, ikke-genkendte posteringer (ingen mapping-regel) der er
 * markant større end gennemsnittet for samme kategori (mindst 3 tidligere
 * posteringer at sammenligne med).
 */
export function detectUnusualAmounts(
  newTransactions: TransactionRow[],
  allTransactions: TransactionRow[],
): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];

  for (const t of newTransactions) {
    if (
      t.mapping_id !== null ||
      t.amount >= 0 ||
      t.category_id === null ||
      t.is_extraordinary
    )
      continue;

    const sameCategory = allTransactions.filter(
      (o) =>
        o.category_id === t.category_id &&
        o.id !== t.id &&
        o.amount < 0 &&
        !o.is_extraordinary,
    );
    if (sameCategory.length < 3) continue;

    const avg =
      sameCategory.reduce((sum, o) => sum + Math.abs(o.amount), 0) /
      sameCategory.length;

    if (Math.abs(t.amount) <= avg * 2.5 || Math.abs(t.amount) - avg <= 200) continue;

    alerts.push({
      type: "unusual_amount",
      label: t.comment ?? t.raw_text,
      transaction_id: t.id,
      mapping_id: null,
      previous_amount: Math.round(avg * 100) / 100,
      new_amount: t.amount,
      month_key: extractMonthKey(t.date),
      typical_day: null,
    });
  }

  return alerts;
}

/** Antal dages margin efter en posts typiske dag i måneden, før den regnes
 * som reelt forsinket - bankdage, weekender og lign. rykker den ægte dato
 * lidt fra måned til måned. */
const MISSING_RECURRING_GRACE_DAYS = 3;

function dayOfMonth(dateIso: string): number {
  return Number(dateIso.slice(8, 10));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Flager mapping-regler der har optrådt i de to foregående måneder, men
 * mangler i en måned der lige er importeret data for. Regler i
 * `discontinuedMappingIds` (manuelt markeret som afsluttet, fx fordi huset er
 * solgt) springes over - de forventes med vilje ikke at komme igen.
 *
 * En regel flages først når vi rent faktisk har uploadet data forbi dens
 * typiske dag i måneden (+ lidt margin) - ellers ville fx en post der plejer
 * at komme den 20. blive fejlagtigt flaget som manglende, blot fordi man kun
 * har uploadet de første par dage af måneden.
 */
export function detectMissingRecurring(
  newTransactions: TransactionRow[],
  allTransactions: TransactionRow[],
  mappingLabels: Map<string, string>,
  discontinuedMappingIds: Set<string> = new Set(),
): DetectedAlert[] {
  const monthKeys = new Set(newTransactions.map((t) => extractMonthKey(t.date)));
  const alerts: DetectedAlert[] = [];

  const mappingIdsInMonth = (monthKey: string) =>
    new Set(
      allTransactions
        .filter(
          (t) =>
            t.mapping_id !== null &&
            !t.is_extraordinary &&
            extractMonthKey(t.date) === monthKey,
        )
        .map((t) => t.mapping_id as string),
    );

  const latestUploadedDayInMonth = (monthKey: string): number | null => {
    const dates = allTransactions
      .filter((t) => extractMonthKey(t.date) === monthKey)
      .map((t) => t.date);
    return dates.length > 0
      ? dayOfMonth(dates.reduce((latest, d) => (d > latest ? d : latest)))
      : null;
  };

  const typicalDayForMapping = (mappingId: string, beforeMonthKey: string): number | null => {
    const days = allTransactions
      .filter(
        (t) =>
          t.mapping_id === mappingId &&
          !t.is_extraordinary &&
          extractMonthKey(t.date) < beforeMonthKey,
      )
      .map((t) => dayOfMonth(t.date));
    return days.length > 0 ? median(days) : null;
  };

  for (const monthKey of monthKeys) {
    const presentThisMonth = mappingIdsInMonth(monthKey);
    const presentPrev = mappingIdsInMonth(shiftMonthKey(monthKey, -1));
    const presentPrev2 = mappingIdsInMonth(shiftMonthKey(monthKey, -2));
    const latestUploadedDay = latestUploadedDayInMonth(monthKey);

    for (const mappingId of presentPrev) {
      if (!presentPrev2.has(mappingId)) continue;
      if (presentThisMonth.has(mappingId)) continue;
      if (discontinuedMappingIds.has(mappingId)) continue;

      const typicalDay = typicalDayForMapping(mappingId, monthKey);
      const dueDay = typicalDay !== null ? typicalDay + MISSING_RECURRING_GRACE_DAYS : 0;
      if (latestUploadedDay !== null && latestUploadedDay < dueDay) continue;

      alerts.push({
        type: "missing_recurring",
        label: mappingLabels.get(mappingId) ?? "Ukendt postering",
        transaction_id: null,
        mapping_id: mappingId,
        previous_amount: null,
        new_amount: null,
        month_key: monthKey,
        typical_day: typicalDay !== null ? Math.round(typicalDay) : null,
      });
    }
  }

  return alerts;
}
