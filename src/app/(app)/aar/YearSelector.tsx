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
        className="rounded-lg px-2 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
      >
        ←
      </button>
      <span className="text-sm font-medium text-white">{year}</span>
      <button
        type="button"
        onClick={() => router.push(`/?year=${year + 1}`)}
        aria-label="Næste år"
        className="rounded-lg px-2 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
      >
        →
      </button>
    </div>
  );
}
