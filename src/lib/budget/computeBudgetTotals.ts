import type { BudgetLineKind } from "@/lib/types/db";

export type BudgetTotals = {
  incomeTotals: number[];
  expenseTotals: number[];
  netTotals: number[];
  /** Saldo ved udgangen af hver måned: startsaldo + nettoresultat måned for måned. */
  balances: number[];
};

/** Summerer et budgets linjer pr. måned og regner den løbende saldo. */
export function computeBudgetTotals(
  lines: { kind: BudgetLineKind; amounts: number[] }[],
  startBalance: number | null,
): BudgetTotals {
  const incomeTotals = Array.from({ length: 12 }, () => 0);
  const expenseTotals = Array.from({ length: 12 }, () => 0);

  for (const line of lines) {
    const target = line.kind === "income" ? incomeTotals : expenseTotals;
    for (let i = 0; i < 12; i++) target[i] += line.amounts[i] ?? 0;
  }

  const netTotals = incomeTotals.map((income, i) => income - expenseTotals[i]);
  const balances: number[] = [];
  let running = startBalance ?? 0;
  for (const net of netTotals) {
    running += net;
    balances.push(running);
  }

  return { incomeTotals, expenseTotals, netTotals, balances };
}
