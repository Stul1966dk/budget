"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { updateMonthlyIncomeOverride } from "./actions";

export function IncomeOverrideForm({
  overrideValue,
  autoDetectedValue,
}: {
  overrideValue: number | null;
  autoDetectedValue: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(overrideValue !== null ? String(overrideValue) : "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed.replace(",", "."));

    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError("Indtast et gyldigt beløb.");
      return;
    }

    setError(null);
    setIsSaving(true);
    const result = await updateMonthlyIncomeOverride(parsed);
    setIsSaving(false);
    if (result.status === "error") {
      setError(result.message ?? "Der opstod en fejl.");
      return;
    }
    router.refresh();
  }

  async function handleReset() {
    setError(null);
    setIsSaving(true);
    await updateMonthlyIncomeOverride(null);
    setValue("");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="income-override" className="block text-xs text-slate-500">
          Forventet månedlig indbetaling (kr.)
        </label>
        <input
          id="income-override"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Auto: ${formatCurrency(autoDetectedValue)}`}
          className="mt-1 w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isSaving ? "Gemmer..." : "Gem"}
      </button>
      {overrideValue !== null && (
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Nulstil til automatisk
        </button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
