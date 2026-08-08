"use client";

import { useState } from "react";
import { suggestMappingPattern } from "@/lib/mapping/suggestPattern";
import type { MatchType } from "@/lib/mapping/types";
import type { Category, TransactionRow } from "@/lib/types/db";

export type EditPanelValues = {
  comment: string | null;
  categoryId: string | null;
  isExtraordinary: boolean;
  createRule: boolean;
  matchPattern?: string;
  matchType?: MatchType;
  minAmount?: number | null;
  maxAmount?: number | null;
};

export function EditPanel({
  transaction,
  categories,
  isSaving,
  onClose,
  onSave,
}: {
  transaction: TransactionRow;
  categories: Category[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: EditPanelValues) => void;
}) {
  const [comment, setComment] = useState(transaction.comment ?? "");
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? "");
  const [isExtraordinary, setIsExtraordinary] = useState(
    transaction.is_extraordinary,
  );
  const [createRule, setCreateRule] = useState(false);
  const [matchPattern, setMatchPattern] = useState(() =>
    suggestMappingPattern(transaction.raw_text),
  );
  const [matchType, setMatchType] = useState<MatchType>("prefix");
  const [useAmountRange, setUseAmountRange] = useState(false);
  const transactionMagnitude = Math.round(Math.abs(transaction.amount) * 100) / 100;
  const [minAmount, setMinAmount] = useState(String(transactionMagnitude - 2));
  const [maxAmount, setMaxAmount] = useState(String(transactionMagnitude + 2));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      comment: comment.trim().length ? comment.trim() : null,
      categoryId: categoryId || null,
      isExtraordinary,
      createRule,
      matchPattern: createRule ? matchPattern.trim() : undefined,
      matchType: createRule ? matchType : undefined,
      minAmount: createRule && useAmountRange && minAmount.trim() ? Number(minAmount) : null,
      maxAmount: createRule && useAmountRange && maxAmount.trim() ? Number(maxAmount) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <p className="text-xs text-stone-400">Rå tekst fra banken</p>
        <p className="mt-0.5 text-sm text-stone-700">{transaction.raw_text}</p>

        <div className="mt-4">
          <label
            htmlFor="comment"
            className="block text-sm font-medium text-stone-700"
          >
            Kommentar
          </label>
          <input
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Fx 'Stigs mobilabonnement'"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="mt-3">
          <label
            htmlFor="category"
            className="block text-sm font-medium text-stone-700"
          >
            Kategori
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          >
            <option value="">Ingen kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={isExtraordinary}
            onChange={(e) => setIsExtraordinary(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Ekstraordinær postering
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={createRule}
            onChange={(e) => setCreateRule(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Anvend automatisk på lignende posteringer fremover?
        </label>

        {createRule && (
          <div className="mt-3 space-y-3 rounded-lg bg-stone-100 p-3">
            <div>
              <label
                htmlFor="matchPattern"
                className="block text-xs font-medium text-stone-600"
              >
                Mønster
              </label>
              <input
                id="matchPattern"
                value={matchPattern}
                onChange={(e) => setMatchPattern(e.target.value)}
                required={createRule}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="matchType"
                className="block text-xs font-medium text-stone-600"
              >
                Match-type
              </label>
              <select
                id="matchType"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as MatchType)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              >
                <option value="prefix">Starter med (prefix)</option>
                <option value="contains">Indeholder (contains)</option>
                <option value="exact">Er præcis (exact)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={useAmountRange}
                onChange={(e) => setUseAmountRange(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300"
              />
              Kræv et bestemt beløb (hvis flere poster deler denne tekst, fx
              flere forsikringer under samme banktekst)
            </label>

            {useAmountRange && (
              <div>
                <label className="block text-xs font-medium text-stone-600">
                  Beløbsinterval (kr., uden fortegn)
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
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
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
    </div>
  );
}
