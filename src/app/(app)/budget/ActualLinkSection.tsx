"use client";

import { useState } from "react";

export type MappingOption = {
  id: string;
  label: string;
  pattern: string;
  active: boolean;
};

const MAX_RESULTS = 8;

/**
 * Vælger hvilke regler (og evt. kategori), der tæller som faktisk forbrug på
 * en budgetpost. Bruges af "Budget mod faktisk".
 */
export function ActualLinkSection({
  lineId,
  mappings,
  mappingUsage,
  selectedIds,
  onChangeSelected,
  categoryName,
  includeCategory,
  onChangeIncludeCategory,
}: {
  lineId: string | null;
  mappings: MappingOption[];
  mappingUsage: Map<string, { lineId: string; label: string }>;
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  categoryName: string | null;
  includeCategory: boolean;
  onChangeIncludeCategory: (value: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = new Map(mappings.map((m) => [m.id, m]));

  const needle = query.trim().toLowerCase();
  const results = needle
    ? mappings
        .filter(
          (m) =>
            !selectedIds.includes(m.id) &&
            (m.label.toLowerCase().includes(needle) ||
              m.pattern.toLowerCase().includes(needle)),
        )
        .slice(0, MAX_RESULTS)
    : [];

  function usedElsewhere(mappingId: string): string | null {
    const usage = mappingUsage.get(mappingId);
    return usage && usage.lineId !== lineId ? usage.label : null;
  }

  return (
    <div className="mt-4 rounded-lg border border-stone-200 p-3">
      <p className="text-xs font-medium text-stone-600">Faktisk forbrug tælles fra</p>
      <p className="mt-0.5 text-xs text-stone-400">
        Posteringer der matcher disse regler, sammenlignes med posten under
        &quot;Budget mod faktisk&quot;.
      </p>

      {selectedIds.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const mapping = byId.get(id);
            const other = usedElsewhere(id);
            return (
              <li
                key={id}
                className="flex items-center gap-1 rounded-full bg-stone-100 py-0.5 pl-2.5 pr-1 text-xs text-stone-700"
                title={other ? `Bruges også af "${other}" - tæller kun på den ene` : undefined}
              >
                <span className={mapping ? "" : "italic text-stone-400"}>
                  {mapping?.label ?? "Slettet regel"}
                  {mapping && !mapping.active && " (slået fra)"}
                  {other && " ⚠"}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeSelected(selectedIds.filter((s) => s !== id))}
                  aria-label={`Fjern ${mapping?.label ?? "regel"}`}
                  className="rounded-full px-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-900"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs italic text-stone-400">Ingen regler valgt.</p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søg efter en regel at tilføje..."
        aria-label="Søg efter regel"
        className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
      />
      {results.length > 0 && (
        <ul className="mt-1 divide-y divide-stone-100 rounded-lg border border-stone-200">
          {results.map((m) => {
            const other = usedElsewhere(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChangeSelected([...selectedIds, m.id]);
                    setQuery("");
                  }}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-stone-50"
                >
                  <span className="truncate text-stone-800">
                    {m.label}
                    {!m.active && <span className="text-stone-400"> (slået fra)</span>}
                  </span>
                  <span className="shrink-0 text-xs text-stone-400">
                    {other ? `bruges af "${other}"` : m.pattern}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {needle && results.length === 0 && (
        <p className="mt-1 text-xs text-stone-400">Ingen regler matcher.</p>
      )}

      <label
        className={`mt-3 flex items-start gap-2 text-sm ${
          categoryName ? "text-stone-700" : "text-stone-400"
        }`}
      >
        <input
          type="checkbox"
          checked={includeCategory && categoryName !== null}
          disabled={categoryName === null}
          onChange={(e) => onChangeIncludeCategory(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span>
          {categoryName
            ? `Medtag også øvrige posteringer i kategorien "${categoryName}"`
            : "Vælg en kategori for at medtage hele kategorien"}
          <span className="block text-xs text-stone-400">
            Posteringer der allerede tæller på en anden post via en regel, tælles ikke dobbelt.
          </span>
        </span>
      </label>
    </div>
  );
}
