const currencyFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
});

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("da-DK", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Forventer en ISO-dato (YYYY-MM-DD). Formatteres som UTC for at undgå at
 * en dato-kolonne uden klokkeslæt rykker en dag pga. lokal tidszone. */
export function formatDateDa(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/** Formatterer en "YYYY-MM"-månedsnøgle som "januar 2026". */
export function formatMonthDa(monthKey: string): string {
  return monthFormatter.format(new Date(`${monthKey}-01T00:00:00Z`));
}
