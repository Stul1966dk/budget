import { formatCurrency, formatMonthDa } from "@/lib/format";
import type { AlertType } from "@/lib/types/db";

type AlertMessageInput = {
  type: AlertType;
  label: string;
  previous_amount: number | null;
  new_amount: number | null;
  month_key: string;
};

export function composeAlertMessage(alert: AlertMessageInput): string {
  switch (alert.type) {
    case "price_increase":
      return `${alert.label} er steget fra ${formatCurrency(Math.abs(alert.previous_amount ?? 0))} til ${formatCurrency(Math.abs(alert.new_amount ?? 0))} om måneden.`;
    case "unusual_amount":
      return `${alert.label}: usædvanligt stort beløb på ${formatCurrency(Math.abs(alert.new_amount ?? 0))} (normalt omkring ${formatCurrency(alert.previous_amount ?? 0)}).`;
    case "missing_recurring":
      return `${alert.label} er ikke dukket op i ${formatMonthDa(alert.month_key)} — plejer ellers at komme hver måned.`;
  }
}
