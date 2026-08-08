"use client";

import { useRouter } from "next/navigation";

export function YearSelector({ year }: { year: number }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push(`/?year=${year - 1}`)}
        aria-label="Forrige år"
        className="rounded-lg px-2 py-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        ←
      </button>
      <span className="text-sm font-medium text-stone-900">{year}</span>
      <button
        type="button"
        onClick={() => router.push(`/?year=${year + 1}`)}
        aria-label="Næste år"
        className="rounded-lg px-2 py-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        →
      </button>
    </div>
  );
}
