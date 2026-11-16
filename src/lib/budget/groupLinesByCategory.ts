import type { Category } from "@/lib/types/db";

export type CategoryGroup<T> = {
  /** null = poster uden kategori. */
  category: Category | null;
  lines: T[];
};

/**
 * Deler budgetposter op efter deres kategori, i kategoriernes egen
 * rækkefølge, med "Uden kategori" til sidst. Posternes rækkefølge inden for
 * en kategori bevares.
 */
export function groupLinesByCategory<T extends { category_id: string | null }>(
  lines: T[],
  categories: Category[],
): CategoryGroup<T>[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string | null, T[]>();

  for (const line of lines) {
    const key = line.category_id && byId.has(line.category_id) ? line.category_id : null;
    const list = groups.get(key);
    if (list) list.push(line);
    else groups.set(key, [line]);
  }

  const ordered: CategoryGroup<T>[] = [];
  for (const category of [...categories].sort((a, b) => a.sort_order - b.sort_order)) {
    const list = groups.get(category.id);
    if (list) ordered.push({ category, lines: list });
  }
  const uncategorized = groups.get(null);
  if (uncategorized) ordered.push({ category: null, lines: uncategorized });
  return ordered;
}
