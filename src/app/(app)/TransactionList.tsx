"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateDa } from "@/lib/format";
import type { Category, TransactionRow } from "@/lib/types/db";
import { applyRuleRetroactively, saveTransactionEdit } from "./actions";
import { EditPanel, type EditPanelValues } from "./EditPanel";
import { ConfirmDialog } from "./ConfirmDialog";

type PendingRule = { id: string; matchCount: number; pattern: string };

export type TransactionFilterCounts = {
  alle: number;
  umatchede: number;
  ekstraordinaere: number;
};

export function TransactionList({
  transactions,
  categories,
  filterMode,
  monthKey,
  counts,
}: {
  transactions: TransactionRow[];
  categories: Category[];
  filterMode: "alle" | "umatchede" | "ekstraordinaere";
  monthKey: string;
  counts: TransactionFilterCounts;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRule, setPendingRule] = useState<PendingRule | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const editing = transactions.find((t) => t.id === editingId) ?? null;

  async function handleSave(values: EditPanelValues) {
    if (!editing) return;
    setIsSaving(true);
    const result = await saveTransactionEdit({ id: editing.id, ...values });
    setIsSaving(false);

    if (result.status === "success") {
      setEditingId(null);
      if (result.newRule && result.newRule.matchCount > 0) {
        setPendingRule(result.newRule);
      }
      router.refresh();
    }
  }

  return (
    <div className="mt-4">
      <nav className="flex flex-wrap gap-2" aria-label="Filtrér posteringer">
        {(
          [
            { mode: "alle", label: "Alle" },
            { mode: "umatchede", label: "Ukategoriserede" },
            { mode: "ekstraordinaere", label: "Ekstraordinære (alle måneder)" },
          ] as const
        ).map(({ mode, label }) => {
          const isActive = filterMode === mode;
          const params = new URLSearchParams({ month: monthKey });
          if (mode !== "alle") params.set("filter", mode);
          return (
            <a
              key={mode}
              href={`?${params.toString()}`}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-white bg-white text-forest-900"
                  : "border-white/40 text-white hover:bg-white/10"
              }`}
            >
              {label}
              <span
                className={`ml-1.5 rounded-full px-1.5 text-xs ${
                  isActive
                    ? "bg-forest-100 text-forest-900"
                    : mode === "umatchede" && counts.umatchede > 0
                      ? "bg-amber-300 text-amber-950"
                      : "bg-white/15 text-white"
                }`}
              >
                {counts[mode]}
              </span>
            </a>
          );
        })}
      </nav>

      {filterMode === "ekstraordinaere" && (
        <p className="mt-2 text-xs text-white/70">
          Viser ekstraordinære posteringer på tværs af alle måneder, uanset
          hvilken måned der er valgt ovenfor.
        </p>
      )}

      {transactions.length === 0 ? (
        <p className="mt-3 text-sm text-white/70">Ingen posteringer at vise.</p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {transactions.map((t) => {
            const category = t.category_id
              ? categoryMap.get(t.category_id)
              : undefined;
            const displayText = t.comment ?? t.raw_text;

            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setEditingId(t.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-100"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <span className="whitespace-nowrap">
                        {formatDateDa(t.date)}
                      </span>
                      {category ? (
                        <span
                          className="truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                          style={{ backgroundColor: category.color ?? "#94a3b8" }}
                        >
                          {category.name}
                        </span>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                          Ukategoriseret
                        </span>
                      )}
                      {t.is_extraordinary && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Ekstraordinær
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-0.5 truncate text-sm text-stone-900"
                      title={t.raw_text}
                    >
                      {displayText}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      t.amount < 0 ? "text-stone-900" : "text-green-700"
                    }`}
                  >
                    {formatCurrency(t.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EditPanel
          transaction={editing}
          categories={categories}
          isSaving={isSaving}
          onClose={() => setEditingId(null)}
          onSave={handleSave}
        />
      )}

      {pendingRule && (
        <ConfirmDialog
          title="Anvend regel på eksisterende posteringer?"
          description={`Reglen "${pendingRule.pattern}" matcher ${pendingRule.matchCount} andre eksisterende posteringer.`}
          confirmLabel="Anvend"
          cancelLabel="Spring over"
          onCancel={() => setPendingRule(null)}
          onConfirm={async () => {
            await applyRuleRetroactively(pendingRule.id);
            setPendingRule(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
