"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateAdvice } from "./actions";

export function RefreshAdviceButton() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsRefreshing(true);
    setError(null);
    const result = await regenerateAdvice();
    if (result.status === "error") {
      setError(result.message ?? "Der opstod en fejl.");
    }
    setIsRefreshing(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isRefreshing}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isRefreshing ? "Genererer..." : "Opdater anbefaling"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
