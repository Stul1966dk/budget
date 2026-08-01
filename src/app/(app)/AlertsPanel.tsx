"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlertRow } from "@/lib/types/db";
import { composeAlertMessage } from "@/lib/alerts/composeAlertMessage";
import { acknowledgeAlert } from "./actions";

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  async function handleDismiss(id: string) {
    setDismissingId(id);
    await acknowledgeAlert(id);
    setDismissingId(null);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">
        Bemærkninger ({alerts.length})
      </h2>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex items-start justify-between gap-3 text-sm text-amber-800"
          >
            <span>{composeAlertMessage(alert)}</span>
            <button
              type="button"
              onClick={() => handleDismiss(alert.id)}
              disabled={dismissingId === alert.id}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              {dismissingId === alert.id ? "..." : "Markér som set"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
