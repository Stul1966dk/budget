"use client";

import { Fragment, useState } from "react";
import { formatKroner, formatMonthShortDa } from "@/lib/format";
import type { BudgetTotals } from "@/lib/budget/computeBudgetTotals";
import type { BudgetActuals, UnbudgetedGroup } from "@/lib/budget/computeBudgetActuals";
import { groupLinesByCategory } from "@/lib/budget/groupLinesByCategory";
import type { BudgetLineKind, BudgetLineRow, Category } from "@/lib/types/db";

const GROUPS_SHOWN = 15;

function sumWhere(values: number[], include: boolean[]): number {
  return values.reduce((s, v, i) => (include[i] ? s + v : s), 0);
}

/** Er afvigelsen god for husstanden? Mindre forbrug / større indtægt er godt. */
function isGood(direction: BudgetLineKind, diff: number): boolean {
  return direction === "expense" ? diff <= 0 : diff >= 0;
}

function diffText(diff: number): string {
  if (Math.abs(diff) < 1) return "±0";
  return `${diff > 0 ? "+" : "−"}${formatKroner(Math.abs(diff))}`;
}

export function BudgetComparison({
  year,
  lines,
  categories,
  budgetTotals,
  actuals,
  actualBalances,
  partialMonthIndex,
  onOpenLine,
  onCreateFromGroup,
}: {
  year: number;
  lines: BudgetLineRow[];
  categories: Category[];
  budgetTotals: BudgetTotals;
  actuals: BudgetActuals;
  actualBalances: (number | null)[];
  partialMonthIndex: number | null;
  onOpenLine: (line: BudgetLineRow) => void;
  onCreateFromGroup: (group: UnbudgetedGroup) => void;
}) {
  const [showAllGroups, setShowAllGroups] = useState(false);
  const has = actuals.monthsWithData;
  const monthKeys = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const zeros = Array.from({ length: 12 }, () => 0);
  const incomeLines = lines.filter((l) => l.kind === "income");
  const expenseLines = lines.filter((l) => l.kind === "expense");
  const anyData = has.some(Boolean);

  function renderGroups(kindLines: BudgetLineRow[], direction: BudgetLineKind) {
    return groupLinesByCategory(kindLines, categories).map((group) => {
      const groupBudget = zeros.map((_, i) =>
        group.lines.reduce((s, l) => s + (l.amounts[i] ?? 0), 0),
      );
      const groupActual = zeros.map((_, i) =>
        group.lines.reduce((s, l) => s + (actuals.lineActuals.get(l.id)?.[i] ?? 0), 0),
      );
      return (
        <Fragment key={group.category?.id ?? "none"}>
          <CompareRow
            label={group.category?.name ?? "Uden kategori"}
            direction={direction}
            budget={groupBudget}
            actual={groupActual}
            has={has}
            group
          />
          {group.lines.map((line) => (
            <CompareRow
              key={line.id}
              label={line.label}
              onClick={() => onOpenLine(line)}
              direction={direction}
              budget={line.amounts}
              actual={actuals.lineActuals.get(line.id) ?? zeros}
              has={has}
              unlinked={line.mapping_ids.length === 0 && !line.include_category}
            />
          ))}
        </Fragment>
      );
    });
  }

  const actualNet = actuals.incomeTotals.map((v, i) => v - actuals.expenseTotals[i]);
  const groups = showAllGroups
    ? actuals.unbudgetedGroups
    : actuals.unbudgetedGroups.slice(0, GROUPS_SHOWN);

  if (!anyData) {
    return (
      <p className="mt-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
        Der er ingen posteringer for {year} endnu. Når I uploader posteringer fra
        året, vises de her ved siden af budgettet.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
              <th className="sticky left-0 z-[1] bg-white px-3 py-2 text-left font-medium">Post</th>
              {monthKeys.map((mk, i) => (
                <th
                  key={mk}
                  className={`px-1.5 py-2 text-right font-medium ${has[i] ? "" : "text-stone-300"}`}
                >
                  {formatMonthShortDa(mk)}
                  {i === partialMonthIndex && "*"}
                </th>
              ))}
              <th className="border-l border-stone-200 px-2 py-2 text-right font-medium">Budget</th>
              <th className="px-2 py-2 text-right font-medium">Faktisk</th>
              <th className="px-3 py-2 text-right font-medium">Forskel</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="Indtægter" />
            {renderGroups(incomeLines, "income")}
            <CompareRow
              label="Ikke budgetteret"
              direction="income"
              budget={zeros}
              actual={actuals.unbudgetedIncome}
              has={has}
              muted
            />
            {actuals.extraordinaryIncome.some((v) => v !== 0) && (
              <CompareRow
                label="Ekstraordinære"
                direction="income"
                budget={zeros}
                actual={actuals.extraordinaryIncome}
                has={has}
                muted
              />
            )}
            <CompareRow
              label="Indtægter i alt"
              direction="income"
              budget={budgetTotals.incomeTotals}
              actual={actuals.incomeTotals}
              has={has}
              total
            />

            <SectionHeader label="Udgifter" />
            {renderGroups(expenseLines, "expense")}
            <CompareRow
              label="Ikke budgetteret"
              direction="expense"
              budget={zeros}
              actual={actuals.unbudgetedExpense}
              has={has}
              muted
            />
            {actuals.extraordinaryExpense.some((v) => v !== 0) && (
              <CompareRow
                label="Ekstraordinære"
                direction="expense"
                budget={zeros}
                actual={actuals.extraordinaryExpense}
                has={has}
                muted
              />
            )}
            <CompareRow
              label="Udgifter i alt"
              direction="expense"
              budget={budgetTotals.expenseTotals}
              actual={actuals.expenseTotals}
              has={has}
              total
            />
          </tbody>
          <tfoot>
            <CompareRow
              label="Nettoresultat"
              direction="income"
              budget={budgetTotals.netTotals}
              actual={actualNet}
              has={has}
              total
            />
            <BalanceRow
              budget={budgetTotals.balances}
              actual={actualBalances}
              has={has}
            />
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-xs text-stone-400">
        Øverst i hver måned står det faktiske beløb, under det forskellen til
        budgettet - grøn er bedre end budgetteret, rød er værre. Måneder uden
        posteringer viser kun budgettet i gråt, og Budget/Faktisk/Forskel
        tæller kun måneder med posteringer.
        {partialMonthIndex !== null &&
          " * Seneste måned er måske ikke uploadet helt endnu."}{" "}
        Poster markeret med ○ er ikke koblet til nogen regel endnu - klik på
        navnet for at koble dem.
      </p>

      {actuals.unbudgetedGroups.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-stone-900">
            Ikke budgetterede posteringer i {year}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Posteringer der ikke tæller på nogen budgetpost. Opret en ny post
            ud fra dem, eller kobl reglen til en eksisterende post ved at
            klikke på postens navn.
          </p>
          <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {groups.map((g) => (
              <li key={g.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-stone-900">{g.label}</p>
                  <p className="text-xs text-stone-400">
                    {g.kind === "income" ? "Indtægt" : "Udgift"} · {g.count}{" "}
                    {g.count === 1 ? "postering" : "posteringer"}
                    {g.isExtraordinary && " · ekstraordinær"}
                    {!g.mappingId && " · ingen regel"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`font-medium ${
                      g.kind === "income" ? "text-green-700" : "text-stone-700"
                    }`}
                  >
                    {formatKroner(g.total)} kr.
                  </span>
                  {g.mappingId && !g.isExtraordinary && (
                    <button
                      type="button"
                      onClick={() => onCreateFromGroup(g)}
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    >
                      Opret post
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {actuals.unbudgetedGroups.length > GROUPS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAllGroups((v) => !v)}
              className="mt-2 text-xs font-medium text-stone-500 underline hover:text-stone-900"
            >
              {showAllGroups
                ? "Vis færre"
                : `Vis alle ${actuals.unbudgetedGroups.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-stone-50">
      <td
        colSpan={16}
        className="sticky left-0 bg-stone-50 px-3 py-1.5 text-left text-xs font-semibold uppercase text-stone-500"
      >
        {label}
      </td>
    </tr>
  );
}

function DiffValue({ direction, diff }: { direction: BudgetLineKind; diff: number }) {
  const neutral = Math.abs(diff) < 1;
  return (
    <span
      className={
        neutral
          ? "text-stone-300"
          : isGood(direction, diff)
            ? "text-green-700"
            : "text-red-600"
      }
    >
      {diffText(diff)}
    </span>
  );
}

function CompareRow({
  label,
  onClick,
  direction,
  budget,
  actual,
  has,
  muted,
  total,
  group,
  unlinked,
}: {
  label: string;
  onClick?: () => void;
  direction: BudgetLineKind;
  budget: number[];
  actual: number[];
  has: boolean[];
  muted?: boolean;
  total?: boolean;
  group?: boolean;
  unlinked?: boolean;
}) {
  const budgetSum = sumWhere(budget, has);
  const actualSum = sumWhere(actual, has);
  // Rækker uden budget og uden forbrug (fx "Ekstraordinære" i en rolig måned) giver kun støj.
  if (muted && actualSum === 0 && actual.every((v) => v === 0)) return null;

  const rowBg = total ? "bg-stone-100 font-medium" : group ? "bg-stone-50 font-semibold" : "";
  const stickyBg = total ? "bg-stone-100" : group ? "bg-stone-50" : "bg-white";
  const indent = onClick ? "pl-6" : "pl-3";

  return (
    <tr className={`border-b border-stone-100 ${rowBg}`}>
      <td className={`sticky left-0 z-[1] max-w-[12rem] py-1 pr-3 text-left text-xs ${indent} ${stickyBg}`}>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="block w-full truncate text-left text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-forest-900"
            title={unlinked ? `${label} - ikke koblet til nogen regel` : label}
          >
            {unlinked && <span className="mr-1 text-stone-400">○</span>}
            {label}
          </button>
        ) : (
          <span className={muted ? "italic text-stone-500" : "text-stone-900"}>{label}</span>
        )}
      </td>
      {budget.map((b, i) => (
        <td key={i} className="px-1.5 py-1 text-right text-xs leading-tight">
          {has[i] ? (
            <>
              <div className="text-stone-800">{formatKroner(actual[i])}</div>
              <div className="text-[10px]">
                <DiffValue direction={direction} diff={actual[i] - b} />
              </div>
            </>
          ) : (
            <span className="text-stone-300">{b === 0 ? "–" : formatKroner(b)}</span>
          )}
        </td>
      ))}
      <td className="border-l border-stone-200 px-2 py-1 text-right text-xs text-stone-500">
        {formatKroner(budgetSum)}
      </td>
      <td className="px-2 py-1 text-right text-xs text-stone-800">{formatKroner(actualSum)}</td>
      <td className="px-3 py-1 text-right text-xs font-medium">
        <DiffValue direction={direction} diff={actualSum - budgetSum} />
      </td>
    </tr>
  );
}

function BalanceRow({
  budget,
  actual,
  has,
}: {
  budget: number[];
  actual: (number | null)[];
  has: boolean[];
}) {
  return (
    <tr className="bg-stone-50 text-stone-600">
      <td className="sticky left-0 z-[1] bg-stone-50 px-3 py-1 text-left text-xs">
        Saldo ved månedens udgang
      </td>
      {budget.map((b, i) => {
        const a = actual[i];
        return (
          <td key={i} className="px-1.5 py-1 text-right text-xs leading-tight">
            {has[i] && a !== null ? (
              <>
                <div className={a >= 0 ? "text-green-700" : "text-red-700"}>{formatKroner(a)}</div>
                <div className="text-[10px]">
                  <DiffValue direction="income" diff={a - b} />
                </div>
              </>
            ) : (
              <span className="text-stone-300">{formatKroner(b)}</span>
            )}
          </td>
        );
      })}
      <td colSpan={3} className="border-l border-stone-200 px-3 py-1 text-right text-[10px] text-stone-400">
        Faktisk saldo fra banken mod budgetteret saldo
      </td>
    </tr>
  );
}
