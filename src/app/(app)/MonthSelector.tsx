"use client";

import { useRouter } from "next/navigation";
import { shiftMonthKey } from "@/lib/month";
import { formatMonthDa } from "@/lib/format";

export function MonthSelector({
  currentMonth,
  availableMonths,
}: {
  currentMonth: string;
  availableMonths: string[];
}) {
  const router = useRouter();

  function go(month: string) {
    router.push(`/maaned?month=${month}`);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-1.5">
      <button
        type="button"
        onClick={() => go(shiftMonthKey(currentMonth, -1))}
        aria-label="Forrige måned"
        className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        ←
      </button>

      <select
        value={currentMonth}
        onChange={(e) => go(e.target.value)}
        className="flex-1 rounded-lg border-0 bg-transparent py-2 text-center text-sm font-medium text-stone-900 focus:outline-none"
      >
        {availableMonths.map((month) => (
          <option key={month} value={month}>
            {formatMonthDa(month)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => go(shiftMonthKey(currentMonth, 1))}
        aria-label="Næste måned"
        className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        →
      </button>
    </div>
  );
}
