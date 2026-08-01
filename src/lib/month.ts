/** Månedsnøgle på formen "YYYY-MM", brugt til at vælge/navigere mellem måneder. */

export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

export function monthKeyToDateRange(monthKey: string): {
  start: string;
  end: string;
} {
  const [year, month] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function extractMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Antal måneder fra `a` til `b` (positivt hvis `b` er senere end `a`). */
export function monthDiff(a: string, b: string): number {
  const [yearA, monthA] = a.split("-").map(Number);
  const [yearB, monthB] = b.split("-").map(Number);
  return yearB * 12 + monthB - (yearA * 12 + monthA);
}
