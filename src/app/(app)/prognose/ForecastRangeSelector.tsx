"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [3, 6, 12, 24];
const MIN_MONTHS = 1;
const MAX_MONTHS = 36;

export function ForecastRangeSelector({ months }: { months: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(months));

  function go(next: number) {
    const clamped = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(next)));
    router.push(`/prognose?months=${clamped}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(value);
    if (Number.isFinite(parsed)) go(parsed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-center gap-2"
      aria-label="Vælg antal måneder frem"
    >
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              months === p
                ? "bg-forest-900 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-100"
            }`}
          >
            {p} mdr.
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <label htmlFor="forecast-months" className="sr-only">
          Antal måneder frem
        </label>
        <input
          id="forecast-months"
          type="number"
          inputMode="numeric"
          min={MIN_MONTHS}
          max={MAX_MONTHS}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm focus:border-stone-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          Vis
        </button>
      </div>
    </form>
  );
}
