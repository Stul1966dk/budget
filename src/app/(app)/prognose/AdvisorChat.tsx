"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdvisorMessageRow } from "@/lib/types/db";
import { askAdvisor, clearAdvisorChat } from "./actions";

export function AdvisorChat({ messages }: { messages: AdvisorMessageRow[] }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingQuestion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setError(null);
    setQuestion("");
    setPendingQuestion(trimmed);
    setIsSending(true);

    const result = await askAdvisor(trimmed);

    setIsSending(false);
    setPendingQuestion(null);

    if (result.status === "error") {
      setError(result.message ?? "Der opstod en fejl.");
      setQuestion(trimmed);
      return;
    }
    router.refresh();
  }

  async function handleClear() {
    setIsSending(true);
    await clearAdvisorChat();
    setIsSending(false);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Spørg rådgiveren</h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSending}
            className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-50"
          >
            Ryd samtale
          </button>
        )}
      </div>

      {messages.length === 0 && !pendingQuestion ? (
        <p className="mt-3 text-sm text-stone-400">
          Stil et spørgsmål om budgettet, fx &quot;Hvorfor var der underskud i
          maj?&quot; eller &quot;Bør vi hæve indbetalingerne?&quot;
        </p>
      ) : (
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-8 bg-forest-900 text-white"
                  : "mr-8 bg-stone-100 text-stone-800"
              }`}
            >
              <p className="whitespace-pre-line">{m.content}</p>
            </div>
          ))}
          {pendingQuestion && (
            <>
              <div className="ml-8 rounded-lg bg-forest-900 px-3 py-2 text-sm text-white">
                <p className="whitespace-pre-line">{pendingQuestion}</p>
              </div>
              <div className="mr-8 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-400">
                Tænker...
              </div>
            </>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Skriv dit spørgsmål..."
          disabled={isSending}
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSending || !question.trim()}
          className="rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50"
        >
          {isSending ? "..." : "Send"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
