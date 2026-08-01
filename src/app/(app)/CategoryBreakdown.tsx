import { formatCurrency } from "@/lib/format";

type BreakdownItem = {
  id: string;
  name: string;
  color: string;
  sum: number;
  share: number;
};

export function CategoryBreakdown({ items }: { items: BreakdownItem[] }) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Udgifter pr. kategori
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{item.name}</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(item.sum)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(item.share * 100, 100)}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
