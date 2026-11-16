import type { BudgetLineKind, BudgetLineRow, TransactionRow } from "@/lib/types/db";

export type ActualTransaction = Pick<
  TransactionRow,
  "id" | "date" | "amount" | "mapping_id" | "category_id" | "is_extraordinary" | "comment" | "raw_text"
>;

export type ActualLine = Pick<
  BudgetLineRow,
  "id" | "kind" | "category_id" | "mapping_ids" | "include_category"
>;

export type MappingLabel = { id: string; label: string };

/** Posteringer der ikke rammer nogen budgetpost, samlet pr. regel eller tekst. */
export type UnbudgetedGroup = {
  key: string;
  label: string;
  kind: BudgetLineKind;
  mappingId: string | null;
  categoryId: string | null;
  isExtraordinary: boolean;
  /** Beløb uden fortegn pr. måned (positivt = i postens retning). */
  months: number[];
  total: number;
  count: number;
};

export type BudgetActuals = {
  /** Faktisk beløb pr. budgetpost og måned, i postens retning (udgift = positivt forbrug). */
  lineActuals: Map<string, number[]>;
  unbudgetedIncome: number[];
  unbudgetedExpense: number[];
  extraordinaryIncome: number[];
  extraordinaryExpense: number[];
  incomeTotals: number[];
  expenseTotals: number[];
  /** Måneder i året med mindst én postering - kun de sammenlignes. */
  monthsWithData: boolean[];
  unbudgetedGroups: UnbudgetedGroup[];
};

const zeros = () => Array.from({ length: 12 }, () => 0);

/**
 * Fordeler årets posteringer på budgetposterne:
 * 1. En postering hvis regel er koblet til en post, tæller på den post.
 * 2. Ellers, hvis en post har "medtag kategorien" og samme kategori, tæller den dér.
 * 3. Resten er "ikke budgetteret" (eller "ekstraordinær", hvis markeret sådan -
 *    de holdes altid uden for budgetposterne, ligesom i prognosen).
 */
export function computeBudgetActuals(
  lines: ActualLine[],
  transactions: ActualTransaction[],
  mappings: MappingLabel[],
  year: number,
): BudgetActuals {
  const yearPrefix = `${year}-`;
  const lineActuals = new Map(lines.map((l) => [l.id, zeros()]));

  const lineByMapping = new Map<string, ActualLine>();
  const lineByCategory = new Map<string, ActualLine>();
  for (const line of lines) {
    for (const mappingId of line.mapping_ids) {
      if (!lineByMapping.has(mappingId)) lineByMapping.set(mappingId, line);
    }
    if (line.include_category && line.category_id && !lineByCategory.has(line.category_id)) {
      lineByCategory.set(line.category_id, line);
    }
  }
  const mappingLabel = new Map(mappings.map((m) => [m.id, m.label]));

  const unbudgetedIncome = zeros();
  const unbudgetedExpense = zeros();
  const extraordinaryIncome = zeros();
  const extraordinaryExpense = zeros();
  const monthsWithData = Array.from({ length: 12 }, () => false);
  const groups = new Map<string, UnbudgetedGroup>();

  for (const t of transactions) {
    if (!t.date.startsWith(yearPrefix)) continue;
    const month = Number(t.date.slice(5, 7)) - 1;
    if (month < 0 || month > 11) continue;
    monthsWithData[month] = true;

    if (!t.is_extraordinary) {
      const line =
        (t.mapping_id ? lineByMapping.get(t.mapping_id) : undefined) ??
        (t.category_id ? lineByCategory.get(t.category_id) : undefined);
      if (line) {
        lineActuals.get(line.id)![month] += line.kind === "income" ? t.amount : -t.amount;
        continue;
      }
    }

    const kind: BudgetLineKind = t.amount > 0 ? "income" : "expense";
    const magnitude = Math.abs(t.amount);
    const bucket = t.is_extraordinary
      ? kind === "income"
        ? extraordinaryIncome
        : extraordinaryExpense
      : kind === "income"
        ? unbudgetedIncome
        : unbudgetedExpense;
    bucket[month] += magnitude;

    const text = t.comment?.trim() || t.raw_text;
    const key = `${t.is_extraordinary ? "x" : "u"}:${kind}:${t.mapping_id ?? `text:${text}`}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: (t.mapping_id && mappingLabel.get(t.mapping_id)) || text,
        kind,
        mappingId: t.mapping_id,
        categoryId: t.category_id,
        isExtraordinary: t.is_extraordinary,
        months: zeros(),
        total: 0,
        count: 0,
      };
      groups.set(key, group);
    }
    group.months[month] += magnitude;
    group.total += magnitude;
    group.count += 1;
  }

  const incomeTotals = zeros();
  const expenseTotals = zeros();
  for (const line of lines) {
    const target = line.kind === "income" ? incomeTotals : expenseTotals;
    lineActuals.get(line.id)!.forEach((v, i) => (target[i] += v));
  }
  for (let i = 0; i < 12; i++) {
    incomeTotals[i] += unbudgetedIncome[i] + extraordinaryIncome[i];
    expenseTotals[i] += unbudgetedExpense[i] + extraordinaryExpense[i];
  }

  return {
    lineActuals,
    unbudgetedIncome,
    unbudgetedExpense,
    extraordinaryIncome,
    extraordinaryExpense,
    incomeTotals,
    expenseTotals,
    monthsWithData,
    unbudgetedGroups: [...groups.values()].sort((a, b) => b.total - a.total),
  };
}
