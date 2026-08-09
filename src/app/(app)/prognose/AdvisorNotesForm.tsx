"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdvisorNotes } from "./actions";

export function AdvisorNotesForm({ notes }: { notes: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(Boolean(notes));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await updateAdvisorNotes(value);
    setIsSaving(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 text-xs font-medium text-stone-500 underline hover:text-stone-900"
      >
        Tilføj egen kontekst til anbefalingen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <label htmlFor="advisor-notes" className="block text-xs font-medium text-stone-600">
        Egen kontekst til anbefalingen (valgfrit)
      </label>
      <textarea
        id="advisor-notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Fx 'Hold øje med Transport, som er stigende pga. stigende benzinpriser'"
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      />
      <p className="mt-1 text-xs text-stone-400">
        Sendes med hver gang anbefalingen genereres, ved siden af husstandens
        tal - ingen kodeændring nødvendig.
      </p>
      <button
        type="submit"
        disabled={isSaving}
        className="mt-2 rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-800 disabled:opacity-50"
      >
        {isSaving ? "Gemmer..." : "Gem"}
      </button>
    </form>
  );
}
