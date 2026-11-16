"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBudget, type CreateBudgetInput } from "./actions";

type Source = "forecast" | "budget" | "empty";

export function CreateBudgetPanel({
  year,
  existingYears,
}: {
  year: number;
  existingYears: number[];
}) {
  const router = useRouter();
  const defaultSourceYear =
    [...existingYears].filter((y) => y < year).at(-1) ?? existingYears.at(-1) ?? null;
  const [source, setSource] = useState<Source>(
    defaultSourceYear !== null ? "budget" : "forecast",
  );
  const [sourceYear, setSourceYear] = useState<number | null>(defaultSourceYear);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, year]),
  )
    .filter((y) => y === year || !existingYears.includes(y))
    .sort((a, b) => a - b);

  async function handleCreate() {
    let input: CreateBudgetInput;
    if (source === "budget") {
      if (sourceYear === null) return;
      input = { year, source, sourceYear };
    } else {
      input = { year, source };
    }

    setError(null);
    setIsSaving(true);
    const result = await createBudget(input);
    setIsSaving(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 max-w-xl rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">
          Der er intet budget for {year} endnu
        </h2>
        <label className="flex items-center gap-2 text-xs text-stone-500">
          År
          <select
            value={year}
            onChange={(e) => router.push(`/budget?year=${e.target.value}`)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-3 space-y-2">
        <legend className="text-xs text-stone-500">Hvad skal budgettet starte med?</legend>

        {existingYears.length > 0 && (
          <SourceOption
            checked={source === "budget"}
            onSelect={() => setSource("budget")}
            title="Kopiér fra et tidligere budget"
            description="Jeres egne rettede tal fra et andet år."
          >
            {source === "budget" && (
              <select
                value={sourceYear ?? ""}
                onChange={(e) => setSourceYear(Number(e.target.value))}
                className="mt-2 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm focus:border-stone-500 focus:outline-none"
              >
                {existingYears.map((y) => (
                  <option key={y} value={y}>
                    Budget {y}
                  </option>
                ))}
              </select>
            )}
          </SourceOption>
        )}

        <SourceOption
          checked={source === "forecast"}
          onSelect={() => setSource("forecast")}
          title="Kopiér fra prognosen"
          description="Posterne fra Rådgiver siden, fremskrevet ud fra jeres posteringer."
        />

        <SourceOption
          checked={source === "empty"}
          onSelect={() => setSource("empty")}
          title="Start med et tomt budget"
          description="Tilføj alle poster selv."
        />
      </fieldset>

      <button
        type="button"
        onClick={handleCreate}
        disabled={isSaving || (source === "budget" && sourceYear === null)}
        className="mt-4 rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50"
      >
        {isSaving ? "Opretter..." : `Opret budget for ${year}`}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SourceOption({
  checked,
  onSelect,
  title,
  description,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        checked ? "border-forest-900 bg-stone-50" : "border-stone-200"
      }`}
    >
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="budget-source"
          checked={checked}
          onChange={onSelect}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium text-stone-900">{title}</span>
          <span className="block text-xs text-stone-500">{description}</span>
        </span>
      </label>
      {children && <div className="pl-6">{children}</div>}
    </div>
  );
}
