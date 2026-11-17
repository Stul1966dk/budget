"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthShortDa } from "@/lib/format";
import { computeBudgetTotals } from "@/lib/budget/computeBudgetTotals";
import {
  computeBudgetActuals,
  type ActualTransaction,
  type UnbudgetedGroup,
} from "@/lib/budget/computeBudgetActuals";
import { groupLinesByCategory } from "@/lib/budget/groupLinesByCategory";
import { formatAmountInput, parseAmountInput } from "@/lib/budget/amountInput";
import type { BudgetLineKind, BudgetLineRow, BudgetRow, Category } from "@/lib/types/db";
import { ConfirmDialog } from "../ConfirmDialog";
import { BudgetLinePanel, type NewLineDefaults } from "./BudgetLinePanel";
import { BudgetComparison } from "./BudgetComparison";
import type { MappingOption } from "./ActualLinkSection";
import { deleteBudget, updateBudgetLineAmounts, updateBudgetStartBalance } from "./actions";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

type PanelState =
  | { mode: "edit"; line: BudgetLineRow }
  | { mode: "create"; defaults: NewLineDefaults }
  | null;

type View = "edit" | "actual";

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

function sumLines(lines: BudgetLineRow[]): number[] {
  return Array.from({ length: 12 }, (_, i) => sum(lines.map((l) => l.amounts[i] ?? 0)));
}

export function BudgetEditor({
  budget,
  initialLines,
  categories,
  mappings,
  transactions,
  actualBalances,
  partialMonthIndex,
}: {
  budget: BudgetRow;
  initialLines: BudgetLineRow[];
  categories: Category[];
  mappings: MappingOption[];
  transactions: ActualTransaction[];
  actualBalances: (number | null)[];
  partialMonthIndex: number | null;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [startBalance, setStartBalance] = useState(budget.start_balance);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [panel, setPanel] = useState<PanelState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [view, setView] = useState<View>("edit");
  const pending = useRef(0);

  const monthKeys = Array.from(
    { length: 12 },
    (_, i) => `${budget.year}-${String(i + 1).padStart(2, "0")}`,
  );
  const totals = computeBudgetTotals(lines, startBalance);
  const actuals = useMemo(
    () =>
      computeBudgetActuals(
        lines,
        transactions,
        mappings.map((m) => ({ id: m.id, label: m.label })),
        budget.year,
      ),
    [lines, transactions, mappings, budget.year],
  );
  const mappingUsage = useMemo(() => {
    const usage = new Map<string, { lineId: string; label: string }>();
    for (const line of lines) {
      for (const id of line.mapping_ids) {
        if (!usage.has(id)) usage.set(id, { lineId: line.id, label: line.label });
      }
    }
    return usage;
  }, [lines]);

  /** Kører et gem-kald og holder "Gemmer..."/"Gemt"-markeringen opdateret. */
  async function track(run: () => Promise<{ status: "success" } | { status: "error"; message: string }>) {
    pending.current += 1;
    setSaveState({ kind: "saving" });
    const result = await run();
    pending.current -= 1;
    if (result.status === "error") {
      setSaveState({ kind: "error", message: result.message });
    } else if (pending.current === 0) {
      setSaveState((prev) => (prev.kind === "error" ? prev : { kind: "saved" }));
    }
    return result;
  }

  function handleAmountChange(lineId: string, monthIndex: number, value: number) {
    const line = lines.find((l) => l.id === lineId);
    if (!line || line.amounts[monthIndex] === value) return;
    const amounts = line.amounts.map((a, i) => (i === monthIndex ? value : a));
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, amounts } : l)));
    void track(() => updateBudgetLineAmounts(lineId, amounts));
  }

  function handleStartBalanceChange(value: number | null) {
    if (value === startBalance) return;
    setStartBalance(value);
    void track(() => updateBudgetStartBalance(budget.id, value));
  }

  function handleLineSaved(line: BudgetLineRow) {
    setLines((prev) =>
      prev.some((l) => l.id === line.id)
        ? prev.map((l) => (l.id === line.id ? line : l))
        : [...prev, line],
    );
    setSaveState({ kind: "saved" });
    setPanel(null);
  }

  function handleLineDeleted(lineId: string) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    setSaveState({ kind: "saved" });
    setPanel(null);
  }

  function handleCreateFromGroup(group: UnbudgetedGroup) {
    setPanel({
      mode: "create",
      defaults: {
        kind: group.kind,
        label: group.label,
        categoryId: group.categoryId,
        mappingIds: group.mappingId ? [group.mappingId] : [],
      },
    });
  }

  async function handleDeleteBudget() {
    setConfirmDelete(false);
    const result = await track(() => deleteBudget(budget.id));
    if (result.status === "success") {
      router.push("/budget");
      router.refresh();
    }
  }

  function renderSection(kind: BudgetLineKind) {
    const kindLines = lines.filter((l) => l.kind === kind);
    if (kindLines.length === 0) {
      return <EmptyRow text={kind === "income" ? "Ingen indtægter endnu." : "Ingen udgifter endnu."} />;
    }
    return groupLinesByCategory(kindLines, categories).map((group) => (
      <CategoryGroupRows
        key={group.category?.id ?? "none"}
        name={group.category?.name ?? "Uden kategori"}
        lines={group.lines}
        onOpen={(line) => setPanel({ mode: "edit", line })}
        onAmountChange={handleAmountChange}
      />
    ));
  }

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Visning"
        className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5"
      >
        {(
          [
            ["edit", "Rediger budget"],
            ["actual", "Budget mod faktisk"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              view === value
                ? "bg-forest-900 text-white"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "actual" ? (
        <BudgetComparison
          year={budget.year}
          lines={lines}
          categories={categories}
          budgetTotals={totals}
          actuals={actuals}
          actualBalances={actualBalances}
          partialMonthIndex={partialMonthIndex}
          onOpenLine={(line) => setPanel({ mode: "edit", line })}
          onCreateFromGroup={handleCreateFromGroup}
        />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <StartBalanceInput value={startBalance} onChange={handleStartBalanceChange} />
              <button
                type="button"
                onClick={() => setPanel({ mode: "create", defaults: { kind: "income" } })}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                + Tilføj indtægt
              </button>
              <button
                type="button"
                onClick={() => setPanel({ mode: "create", defaults: { kind: "expense" } })}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                + Tilføj udgift
              </button>
            </div>
            <SaveIndicator state={saveState} />
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
                  <th className="sticky left-0 z-[1] bg-white px-3 py-2 text-left font-medium">
                    Post
                  </th>
                  {monthKeys.map((mk) => (
                    <th key={mk} className="px-1 py-2 text-right font-medium">
                      {formatMonthShortDa(mk)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Indtægter" />
                {renderSection("income")}
                <TotalRow label="Indtægter i alt" values={totals.incomeTotals} tone="income" />

                <SectionHeader label="Udgifter" />
                {renderSection("expense")}
                <TotalRow label="Udgifter i alt" values={totals.expenseTotals} tone="expense" />
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 bg-stone-100 font-semibold">
                  <td className="sticky left-0 z-[1] bg-stone-100 px-3 py-2 text-left text-stone-900">
                    Nettoresultat
                  </td>
                  {totals.netTotals.map((value, i) => (
                    <td key={i} className={`px-2 py-2 text-right text-xs ${signClass(value)}`}>
                      {formatCurrency(value)}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right text-xs ${signClass(sum(totals.netTotals))}`}>
                    {formatCurrency(sum(totals.netTotals))}
                  </td>
                </tr>
                <tr className="bg-stone-50 text-stone-600">
                  <td className="sticky left-0 z-[1] bg-stone-50 px-3 py-2 text-left">
                    Forventet saldo
                  </td>
                  {totals.balances.map((value, i) => (
                    <td key={i} className={`px-2 py-2 text-right text-xs ${signClass(value)}`}>
                      {formatCurrency(value)}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right text-xs ${signClass(totals.balances[11])}`}>
                    {formatCurrency(totals.balances[11])}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-2 text-xs text-white/70">
            Posterne er grupperet efter deres kategori. Klik på et beløb for at
            rette det - det gemmes, når du forlader feltet. Klik på en posts
            navn for at omdøbe den, skifte kategori, fordele et beløb over året,
            koble den til regler eller slette den. &quot;Forventet saldo&quot;
            lægger hver måneds nettoresultat oveni startsaldoen.
          </p>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-6 text-xs text-white/70 underline hover:text-red-200"
          >
            Slet budgettet for {budget.year}
          </button>
        </>
      )}

      {panel && (
        <BudgetLinePanel
          budgetId={budget.id}
          year={budget.year}
          line={panel.mode === "edit" ? panel.line : null}
          defaults={panel.mode === "create" ? panel.defaults : { kind: panel.line.kind }}
          categories={categories}
          mappings={mappings}
          mappingUsage={mappingUsage}
          onClose={() => setPanel(null)}
          onSaved={handleLineSaved}
          onDeleted={handleLineDeleted}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Slet budgettet for ${budget.year}?`}
          description="Alle poster i budgettet slettes. Det kan ikke fortrydes."
          confirmLabel="Slet budget"
          cancelLabel="Annuller"
          onConfirm={handleDeleteBudget}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function CategoryGroupRows({
  name,
  lines,
  onOpen,
  onAmountChange,
}: {
  name: string;
  lines: BudgetLineRow[];
  onOpen: (line: BudgetLineRow) => void;
  onAmountChange: (lineId: string, monthIndex: number, value: number) => void;
}) {
  const subtotals = sumLines(lines);
  return (
    <>
      <tr className="border-b border-stone-100">
        <td className="sticky left-0 z-[1] bg-stone-50 px-3 py-1.5 text-left text-xs font-semibold text-stone-800">
          {name}
        </td>
        {subtotals.map((value, i) => (
          <td key={i} className="bg-stone-50 px-2 py-1.5 text-right text-xs font-medium text-stone-500">
            {value === 0 ? "–" : formatCurrency(value)}
          </td>
        ))}
        <td className="bg-stone-50 px-3 py-1.5 text-right text-xs font-semibold text-stone-700">
          {formatCurrency(sum(subtotals))}
        </td>
      </tr>
      {lines.map((line) => (
        <EditableRow
          key={line.id}
          line={line}
          onOpen={() => onOpen(line)}
          onAmountChange={onAmountChange}
        />
      ))}
    </>
  );
}

function signClass(value: number): string {
  return value >= 0 ? "text-green-700" : "text-red-700";
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "error") {
    return <p className="text-xs text-red-600">{state.message}</p>;
  }
  return (
    <p className="text-xs text-stone-400">
      {state.kind === "saving" ? "Gemmer..." : "Alle ændringer er gemt"}
    </p>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-stone-50">
      <td
        colSpan={14}
        className="sticky left-0 bg-stone-50 px-3 py-1.5 text-left text-xs font-semibold uppercase text-stone-500"
      >
        {label}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone: "income" | "expense";
}) {
  const textClass = tone === "income" ? "text-green-700" : "text-red-700";

  return (
    <tr className="border-b border-stone-200 bg-stone-100 font-medium">
      <td className="sticky left-0 z-[1] bg-stone-100 px-3 py-2 text-left text-stone-900">
        {label}
      </td>
      {values.map((value, i) => (
        <td key={i} className={`px-2 py-2 text-right text-xs ${textClass}`}>
          {formatCurrency(value)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right text-xs ${textClass}`}>
        {formatCurrency(sum(values))}
      </td>
    </tr>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={14} className="px-3 py-2 text-left text-xs text-stone-400">
        {text}
      </td>
    </tr>
  );
}

function EditableRow({
  line,
  onOpen,
  onAmountChange,
}: {
  line: BudgetLineRow;
  onOpen: () => void;
  onAmountChange: (lineId: string, monthIndex: number, value: number) => void;
}) {
  const textClass = line.kind === "income" ? "text-green-700" : "text-stone-700";

  return (
    <tr className="border-b border-stone-50">
      <td className="sticky left-0 z-[1] max-w-[12rem] bg-white py-1 pl-6 pr-3 text-left">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full truncate text-left text-xs text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-forest-900 hover:decoration-forest-900"
          title={line.label}
        >
          {line.label}
        </button>
      </td>
      {line.amounts.map((value, i) => (
        <td key={i} className="px-0.5 py-0.5">
          <AmountCell
            value={value}
            label={`${line.label}, måned ${i + 1}`}
            className={textClass}
            onCommit={(v) => onAmountChange(line.id, i, v)}
          />
        </td>
      ))}
      <td className={`px-3 py-1 text-right text-xs font-medium ${textClass}`}>
        {formatCurrency(sum(line.amounts))}
      </td>
    </tr>
  );
}

/** Et beløbsfelt der ligner almindelig tekst, indtil man klikker i det. */
function AmountCell({
  value,
  label,
  className,
  onCommit,
}: {
  value: number;
  label: string;
  className: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const cancelled = useRef(false);

  function commit() {
    if (draft === null) return;
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      setInvalid(false);
      return;
    }
    const parsed = parseAmountInput(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    onCommit(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? formatAmountInput(value)}
      placeholder="–"
      onFocus={(e) => {
        setDraft(formatAmountInput(value));
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={`w-full min-w-[4.5rem] rounded border bg-transparent px-1.5 py-1 text-right text-xs placeholder:text-stone-300 hover:border-stone-300 focus:border-stone-500 focus:bg-white focus:outline-none ${
        invalid ? "border-red-400 bg-red-50" : "border-transparent"
      } ${className}`}
    />
  );
}

function StartBalanceInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  function commit() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(null);
      setInvalid(false);
      onChange(null);
      return;
    }
    const negative = trimmed.startsWith("-");
    const parsed = parseAmountInput(negative ? trimmed.slice(1) : trimmed);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    onChange(negative ? -parsed : parsed);
  }

  const shown =
    value === null ? "" : `${value < 0 ? "-" : ""}${formatAmountInput(Math.abs(value)) || "0"}`;

  return (
    <div>
      <label htmlFor="start-balance" className="block text-xs text-white/80">
        Saldo ved årets start (kr.)
      </label>
      <input
        id="start-balance"
        type="text"
        inputMode="decimal"
        value={draft ?? shown}
        placeholder="Ukendt"
        onFocus={() => setDraft(shown)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`mt-1 w-40 rounded-lg border bg-white px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none ${
          invalid ? "border-red-400 bg-red-50" : "border-stone-300"
        }`}
      />
    </div>
  );
}
