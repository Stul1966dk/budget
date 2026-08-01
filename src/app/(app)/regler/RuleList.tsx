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
      <p className="mt-6 text-sm text-slate-400">
        Ingen regler oprettet endnu. Opret en regel ved at redigere en
        postering på oversigten og markere &quot;Anvend automatisk på
        lignende posteringer fremover&quot;.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                rule.active ? "" : "bg-slate-50/60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 ${
                      rule.active ? "" : "line-through opacity-60"
                    }`}
                  >
                    {rule.match_pattern}
                  </span>
                  <span className="text-xs text-slate-400">
                    {matchTypeLabel(rule.match_type)}
                  </span>
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
                  <p className="mt-1 text-sm text-slate-600">{rule.comment}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
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
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                >
                  {rule.active ? "Markér som afsluttet" : "Genaktivér"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(rule.id)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as MatchType)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      >
        <option value="">Ingen kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Annuller
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSaving ? "Gemmer..." : "Gem"}
        </button>
      </div>
    </form>
  );
}
