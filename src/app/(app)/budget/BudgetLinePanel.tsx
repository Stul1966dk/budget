"use client";

import { useState } from "react";
import { formatCurrency, formatMonthShortDa } from "@/lib/format";
import { formatAmountInput, parseAmountInput } from "@/lib/budget/amountInput";
import type { BudgetLineKind, BudgetLineRow, Category } from "@/lib/types/db";
import { ConfirmDialog } from "../ConfirmDialog";
import { deleteBudgetLine, saveBudgetLine } from "./actions";

type FillMode = "monthly" | "quarterly" | "halfyearly" | "yearly" | "spread";

const FILL_LABELS: Record<FillMode, string> = {
  monthly: "Samme beløb hver måned",
  quarterly: "Hvert kvartal",
  halfyearly: "Hvert halve år",
  yearly: "Én gang om året",
  spread: "Årsbeløb fordelt på 12 måneder",
};

/** Hvor mange måneder der er mellem hver betaling for et givent interval. */
const FILL_STEP: Partial<Record<FillMode, number>> = { quarterly: 3, halfyearly: 6, yearly: 12 };

export function BudgetLinePanel({
  budgetId,
  year,
  line,
  defaultKind,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  budgetId: string;
  year: number;
  line: BudgetLineRow | null;
  defaultKind: BudgetLineKind;
  categories: Category[];
  onClose: () => void;
  onSaved: (line: BudgetLineRow) => void;
  onDeleted: (lineId: string) => void;
}) {
  const [label, setLabel] = useState(line?.label ?? "");
  const [kind, setKind] = useState<BudgetLineKind>(line?.kind ?? defaultKind);
  const [categoryId, setCategoryId] = useState(line?.category_id ?? "");
  const [amounts, setAmounts] = useState<string[]>(
    (line?.amounts ?? Array(12).fill(0)).map(formatAmountInput),
  );
  const [fillMode, setFillMode] = useState<FillMode>("monthly");
  const [fillAmount, setFillAmount] = useState("");
  const [fillStartMonth, setFillStartMonth] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmounts = amounts.map(parseAmountInput);
  const hasInvalid = parsedAmounts.some((a) => a === null);
  const yearTotal = parsedAmounts.reduce<number>((s, a) => s + (a ?? 0), 0);

  function applyFill() {
    const value = parseAmountInput(fillAmount);
    if (value === null || value === 0) {
      setError("Indtast et beløb at udfylde med.");
      return;
    }
    setError(null);

    let next: number[];
    if (fillMode === "monthly") {
      next = Array(12).fill(value);
    } else if (fillMode === "spread") {
      // Rund til hele kroner og læg resten på december, så summen passer.
      const perMonth = Math.floor(value / 12);
      next = Array(12).fill(perMonth);
      next[11] = Math.round((value - perMonth * 11) * 100) / 100;
    } else {
      const step = FILL_STEP[fillMode]!;
      next = Array.from({ length: 12 }, (_, i) =>
        i >= fillStartMonth && (i - fillStartMonth) % step === 0 ? value : 0,
      );
      // Ligger startmåneden sent på året, fyldes også måneder før den med
      // samme rytme (fx kvartalsvis fra november = feb, maj, aug, nov).
      for (let i = fillStartMonth - step; i >= 0; i -= step) next[i] = value;
    }
    setAmounts(next.map(formatAmountInput));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasInvalid) {
      setError("Ret de markerede beløb.");
      return;
    }
    if (label.trim() === "") {
      setError("Giv posten et navn.");
      return;
    }

    setError(null);
    setIsSaving(true);
    const fields = {
      kind,
      label: label.trim(),
      categoryId: categoryId || null,
      amounts: parsedAmounts as number[],
    };
    const result = await saveBudgetLine(
      line
        ? { mode: "update", lineId: line.id, ...fields }
        : { mode: "create", budgetId, ...fields },
    );
    setIsSaving(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    onSaved(result.line);
  }

  async function handleDelete() {
    if (!line) return;
    setConfirmDelete(false);
    setIsSaving(true);
    const result = await deleteBudgetLine(line.id);
    setIsSaving(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    onDeleted(line.id);
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <h2 className="text-base font-semibold text-stone-900">
          {line ? "Ret post" : kind === "income" ? "Ny indtægt" : "Ny udgift"}
        </h2>

        <div className="mt-3">
          <label htmlFor="line-label" className="block text-sm font-medium text-stone-700">
            Navn
          </label>
          <input
            id="line-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Fx 'Bilforsikring'"
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="line-kind" className="block text-sm font-medium text-stone-700">
              Type
            </label>
            <select
              id="line-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as BudgetLineKind)}
              className={inputClass}
            >
              <option value="expense">Udgift</option>
              <option value="income">Indtægt</option>
            </select>
          </div>
          <div>
            <label htmlFor="line-category" className="block text-sm font-medium text-stone-700">
              Kategori
            </label>
            <select
              id="line-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Ingen kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-stone-100 p-3">
          <p className="text-xs font-medium text-stone-600">Udfyld måneder</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={fillMode}
              onChange={(e) => setFillMode(e.target.value as FillMode)}
              aria-label="Interval"
              className="col-span-2 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none sm:col-span-3"
            >
              {(Object.keys(FILL_LABELS) as FillMode[]).map((m) => (
                <option key={m} value={m}>
                  {FILL_LABELS[m]}
                </option>
              ))}
            </select>
            <input
              value={fillAmount}
              onChange={(e) => setFillAmount(e.target.value)}
              inputMode="decimal"
              placeholder={fillMode === "spread" ? "Årsbeløb (kr.)" : "Beløb (kr.)"}
              aria-label="Beløb"
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
            />
            {FILL_STEP[fillMode] ? (
              <select
                value={fillStartMonth}
                onChange={(e) => setFillStartMonth(Number(e.target.value))}
                aria-label="Betales i"
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {fillMode === "yearly" ? "i " : "bl.a. i "}
                    {formatMonthShortDa(`${year}-${String(i + 1).padStart(2, "0")}`)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden sm:block" />
            )}
            <button
              type="button"
              onClick={applyFill}
              className="col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:col-span-1"
            >
              Udfyld
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {amounts.map((value, i) => (
            <div key={i}>
              <label
                htmlFor={`amount-${i}`}
                className="block text-xs text-stone-500"
              >
                {formatMonthShortDa(`${year}-${String(i + 1).padStart(2, "0")}`)}
              </label>
              <input
                id={`amount-${i}`}
                value={value}
                onChange={(e) =>
                  setAmounts((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                }
                inputMode="decimal"
                placeholder="0"
                className={`mt-0.5 w-full rounded-lg border px-2 py-1.5 text-right text-sm focus:border-stone-500 focus:outline-none ${
                  parsedAmounts[i] === null ? "border-red-400 bg-red-50" : "border-stone-300"
                }`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-right text-sm text-stone-600">
          I alt for året: <span className="font-semibold">{formatCurrency(yearTotal)}</span>
        </p>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          {line && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Slet
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Annuller
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50"
          >
            {isSaving ? "Gemmer..." : "Gem"}
          </button>
        </div>
      </form>

      {confirmDelete && line && (
        <ConfirmDialog
          title={`Slet "${line.label}"?`}
          description="Posten fjernes fra budgettet. Det kan ikke fortrydes."
          confirmLabel="Slet post"
          cancelLabel="Annuller"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
