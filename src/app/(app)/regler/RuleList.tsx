"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, TextMappingRow } from "@/lib/types/db";
import type { MatchType } from "@/lib/mapping/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { deleteMappingRule, setMappingRuleActive, updateMappingRule } from "./actions";

function matchTypeLabel(type: MatchType): string {
  switch (type) {
    case "prefix":
      return "starter med";
    case "contains":
      return "indeholder";
    case "exact":
      return "er præcis";
  }
}

function amountRangeLabel(
  minAmount: number | null,
  maxAmount: number | null,
): string | null {
  if (minAmount === null && maxAmount === null) return null;
  if (minAmount !== null && maxAmount !== null) {
    return `${minAmount}–${maxAmount} kr.`;
  }
  if (minAmount !== null) return `over ${minAmount} kr.`;
  return `op til ${maxAmount} kr.`;
}

export function RuleList({
  rules,
  categories,
  matchCounts,
}: {
  rules: TextMappingRow[];
  categories: Category[];
  matchCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const ruleToDelete = rules.find((r) => r.id === confirmingDeleteId) ?? null;

  if (rules.length === 0) {
    return (
      <p className="mt-6 text-sm text-stone-400">
        Ingen regler oprettet endnu. Opret en regel ved at redigere en
        postering på oversigten og markere &quot;Anvend automatisk på
        lignende posteringer fremover&quot;.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {rules.map((rule) => {
          const category = rule.category_id
            ? categoryMap.get(rule.category_id)
            : undefined;

          if (editingId === rule.id) {
            return (
              <li key={rule.id} className="p-4">
                <RuleEditForm
                  rule={rule}
                  categories={categories}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                />
              </li>
            );
          }

          return (
            <li
              key={rule.id}
              className={`flex items-start justify-between gap-3 p-4 ${
                rule.active ? "" : "bg-stone-100/60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700 ${
                      rule.active ? "" : "line-through opacity-60"
                    }`}
                  >
                    {rule.match_pattern}
                  </span>
                  <span className="text-xs text-stone-400">
                    {matchTypeLabel(rule.match_type)}
                  </span>
                  {amountRangeLabel(rule.min_amount, rule.max_amount) && (
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {amountRangeLabel(rule.min_amount, rule.max_amount)}
                    </span>
                  )}
                  {rule.display_mode === "individual" && (
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      Vises hver for sig
                    </span>
                  )}
                  {rule.is_extraordinary && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      Ekstraordinær
                    </span>
                  )}
                  {category && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${
                        rule.active ? "" : "opacity-50"
                      }`}
                      style={{ backgroundColor: category.color ?? "#94a3b8" }}
                    >
                      {category.name}
                    </span>
                  )}
                  {!rule.active && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Afsluttet
                    </span>
                  )}
                </div>
                {rule.comment && (
                  <p className="mt-1 text-sm text-stone-600">{rule.comment}</p>
                )}
                <p className="mt-1 text-xs text-stone-400">
                  {matchCounts[rule.id] ?? 0} posteringer matchet
                  {!rule.active &&
                    " · indgår ikke i prognose eller alarmer om manglende poster"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={togglingId === rule.id}
                  onClick={async () => {
                    setTogglingId(rule.id);
                    await setMappingRuleActive(rule.id, !rule.active);
                    setTogglingId(null);
                    router.refresh();
                  }}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                >
                  {rule.active ? "Markér som afsluttet" : "Genaktivér"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(rule.id)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                >
                  Redigér
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(rule.id)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Slet
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {ruleToDelete && (
        <ConfirmDialog
          title="Slet regel?"
          description={`Reglen "${ruleToDelete.match_pattern}" bliver slettet. Posteringer der allerede har fået kommentar/kategori fra reglen, beholder dem.`}
          confirmLabel={isDeleting ? "Sletter..." : "Slet"}
          cancelLabel="Annuller"
          onCancel={() => setConfirmingDeleteId(null)}
          onConfirm={async () => {
            setIsDeleting(true);
            await deleteMappingRule(ruleToDelete.id);
            setIsDeleting(false);
            setConfirmingDeleteId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function RuleEditForm({
  rule,
  categories,
  onCancel,
  onSaved,
}: {
  rule: TextMappingRow;
  categories: Category[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [matchPattern, setMatchPattern] = useState(rule.match_pattern);
  const [matchType, setMatchType] = useState<MatchType>(rule.match_type);
  const [comment, setComment] = useState(rule.comment ?? "");
  const [categoryId, setCategoryId] = useState(rule.category_id ?? "");
  const [minAmount, setMinAmount] = useState(
    rule.min_amount !== null ? String(rule.min_amount) : "",
  );
  const [maxAmount, setMaxAmount] = useState(
    rule.max_amount !== null ? String(rule.max_amount) : "",
  );
  const [displayMode, setDisplayMode] = useState<"grouped" | "individual">(
    rule.display_mode,
  );
  const [isExtraordinary, setIsExtraordinary] = useState(rule.is_extraordinary);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await updateMappingRule({
      id: rule.id,
      matchPattern: matchPattern.trim(),
      matchType,
      comment: comment.trim().length ? comment.trim() : null,
      categoryId: categoryId || null,
      minAmount: minAmount.trim() ? Number(minAmount.trim().replace(",", ".")) : null,
      maxAmount: maxAmount.trim() ? Number(maxAmount.trim().replace(",", ".")) : null,
      displayMode,
      isExtraordinary,
    });
    setIsSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          value={matchPattern}
          onChange={(e) => setMatchPattern(e.target.value)}
          required
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        />
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as MatchType)}
          className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm focus:border-stone-500 focus:outline-none"
        >
          <option value="prefix">Starter med</option>
          <option value="contains">Indeholder</option>
          <option value="exact">Er præcis</option>
        </select>
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Kommentar"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      >
        <option value="">Ingen kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Beløbsinterval (valgfrit, kr. uden fortegn - skelner poster med
          identisk tekst)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Min"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <span className="text-stone-400">–</span>
          <input
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Max"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Visning
        </label>
        <select
          value={displayMode}
          onChange={(e) => setDisplayMode(e.target.value as "grouped" | "individual")}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        >
          <option value="grouped">Saml til én post</option>
          <option value="individual">Vis hver for sig</option>
        </select>
        <p className="mt-1 text-xs text-stone-400">
          Brug &quot;Vis hver for sig&quot; til poster der reelt er
          forskellige ting, men ikke kan skelnes automatisk (fx flere
          abonnementer under samme banktekst) - så kan du selv navngive hver
          enkelt postering.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={isExtraordinary}
          onChange={(e) => setIsExtraordinary(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        Ekstraordinær (holdes udenfor opsparingsrate, prognose, kategori-trends
        og AI-rådgiver)
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
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
  );
}
