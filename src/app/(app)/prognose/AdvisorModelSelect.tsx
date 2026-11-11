"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailableModel } from "@/lib/advisor/advisorClient";
import { updateAdvisorModel } from "./actions";

export function AdvisorModelSelect({
  chosenModel,
  defaultModel,
  models,
}: {
  chosenModel: string | null;
  defaultModel: string;
  /** null når modellisten ikke kunne hentes fra Anthropic. */
  models: AvailableModel[] | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(chosenModel ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const previous = value;
    setValue(next);
    setError(null);
    setIsSaving(true);
    const result = await updateAdvisorModel(next || null);
    setIsSaving(false);
    if (result.status === "error") {
      setValue(previous);
      setError(result.message ?? "Kunne ikke gemme modelvalget.");
      return;
    }
    router.refresh();
  }

  // Et tidligere valg, som API'et ikke længere tilbyder, vises stadig, så
  // vælgeren ikke stille lader som om standarden er valgt.
  const chosenIsMissing =
    chosenModel !== null && models !== null && !models.some((m) => m.id === chosenModel);

  return (
    <div className="mt-3">
      <label htmlFor="advisor-model" className="block text-xs font-medium text-stone-600">
        Sprogmodel
      </label>
      <select
        id="advisor-model"
        value={value}
        onChange={handleChange}
        disabled={isSaving || models === null}
        className="mt-1 w-full max-w-sm rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">Standard ({defaultModel})</option>
        {chosenIsMissing && (
          <option value={chosenModel}>{chosenModel} (ikke længere tilgængelig)</option>
        )}
        {models?.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName} ({m.id})
          </option>
        ))}
      </select>
      {models === null ? (
        <p className="mt-1 text-xs text-stone-400">
          Kunne ikke hente listen over modeller fra Anthropic lige nu - rådgiveren
          bruger {chosenModel ?? defaultModel}.
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-400">
          Bruges til både anbefalingen og chatten. Listen hentes direkte fra
          Anthropic, så nye modeller dukker op af sig selv.
        </p>
      )}
      {isSaving && <p className="mt-1 text-xs text-stone-500">Gemmer...</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
