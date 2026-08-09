"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types/db";
import { ConfirmDialog } from "../ConfirmDialog";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "./categoryActions";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const categoryToDelete = categories.find((c) => c.id === confirmingDeleteId) ?? null;

  async function handleMove(id: string, direction: "up" | "down") {
    setMovingId(id);
    await moveCategory(id, direction);
    setMovingId(null);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold text-stone-900">
          Kategorier ({categories.length})
        </h2>
        <span className="text-xs font-medium text-stone-400">
          {isOpen ? "Skjul" : "Vis og redigér"}
        </span>
      </button>

      {isOpen && (
        <>
          <ul className="mt-3 divide-y divide-stone-100">
            {categories.map((category, index) => (
              <li key={category.id} className="py-2">
                {editingId === category.id ? (
                  <CategoryForm
                    category={category}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color ?? "#94a3b8" }}
                      />
                      <span className="truncate text-sm text-stone-800">{category.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(category.id, "up")}
                        disabled={movingId !== null || index === 0}
                        aria-label="Flyt op"
                        className="rounded-lg px-2 py-1 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(category.id, "down")}
                        disabled={movingId !== null || index === categories.length - 1}
                        aria-label="Flyt ned"
                        className="rounded-lg px-2 py-1 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(category.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                      >
                        Redigér
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(category.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        Slet
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {isCreating ? (
            <div className="mt-3">
              <CategoryForm
                onCancel={() => setIsCreating(false)}
                onSaved={() => {
                  setIsCreating(false);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              + Ny kategori
            </button>
          )}
        </>
      )}

      {categoryToDelete && (
        <ConfirmDialog
          title="Slet kategori?"
          description={`Kategorien "${categoryToDelete.name}" bliver slettet. Regler og posteringer der bruger den, mister kategorien (vises som "Ingen kategori"/"Ukategoriseret") men slettes ikke selv.`}
          confirmLabel={isDeleting ? "Sletter..." : "Slet"}
          cancelLabel="Annuller"
          onCancel={() => setConfirmingDeleteId(null)}
          onConfirm={async () => {
            setIsDeleting(true);
            await deleteCategory(categoryToDelete.id);
            setIsDeleting(false);
            setConfirmingDeleteId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onCancel,
  onSaved,
}: {
  category?: Category;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? "#64748b");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const result = category
      ? await updateCategory({ id: category.id, name: name.trim(), color })
      : await createCategory({ name: name.trim(), color });

    setIsSaving(false);

    if (result.status === "error") {
      setError(result.message ?? "Der opstod en fejl.");
      return;
    }
    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-100 p-3"
    >
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Farve"
        className="h-9 w-9 shrink-0 rounded border border-stone-300 bg-white p-0.5"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Kategorinavn"
        required
        className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        Annuller
      </button>
      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-forest-900 px-3 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50"
      >
        {isSaving ? "Gemmer..." : "Gem"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
