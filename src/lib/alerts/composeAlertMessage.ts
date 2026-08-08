import { formatCurrency, formatMonthDa } from "@/lib/format";
import type { AlertType } from "@/lib/types/db";

type AlertMessageInput = {
  type: AlertType;
  label: string;
  previous_amount: number | null;
  new_amount: number | null;
  month_key: string;
  typical_day: number | null;
};

export function composeAlertMessage(alert: AlertMessageInput): string {
  switch (alert.type) {
    case "price_increase":
      return `${alert.label} er steget fra ${formatCurrency(Math.abs(alert.previous_amount ?? 0))} til ${formatCurrency(Math.abs(alert.new_amount ?? 0))} om måneden.`;
    case "unusual_amount":
      return `${alert.label}: usædvanligt stort beløb på ${formatCurrency(Math.abs(alert.new_amount ?? 0))} (normalt omkring ${formatCurrency(alert.previous_amount ?? 0)}).`;
    case "missing_recurring": {
      const timing =
        typeof alert.typical_day === "number"
          ? `plejer ellers at komme omkring den ${alert.typical_day}. hver måned`
          : "plejer ellers at komme hver måned";
      return `${alert.label} er ikke dukket op i ${formatMonthDa(alert.month_key)} — ${timing}.`;
    }
  }
}
