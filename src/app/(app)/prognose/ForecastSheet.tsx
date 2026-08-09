import { formatCurrency, formatMonthShortDa } from "@/lib/format";
import type { ForecastLineItem } from "@/lib/forecast/computeForecastLineItems";

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

export function ForecastSheet({
  monthKeys,
  incomeItems,
  expenseItems,
  otherExpenseAverage,
  incomeTotals,
  expenseTotals,
  netTotals,
  projectedBalances,
  incomeIsOverridden,
}: {
  monthKeys: string[];
  incomeItems: ForecastLineItem[];
  expenseItems: ForecastLineItem[];
  otherExpenseAverage: number;
  incomeTotals: number[];
  expenseTotals: number[];
  netTotals: number[];
  projectedBalances: number[];
  incomeIsOverridden: boolean;
}) {
  const otherExpenseRow = monthKeys.map(() => otherExpenseAverage);

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
            <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium">
              Post
            </th>
            {monthKeys.map((mk) => (
              <th key={mk} className="px-2 py-2 text-right font-medium">
                {formatMonthShortDa(mk)}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          <ItemRows items={incomeItems} tone="income" />
          <TotalRow
            label={incomeIsOverridden ? "Indbetaling i alt (manuel)" : "Indbetaling i alt"}
            values={incomeTotals}
            tone="income"
          />

          <ItemRows items={expenseItems} tone="expense" />
          <LineRow
            label="Øvrige udgifter (gns.)"
            values={otherExpenseRow}
            total={sum(otherExpenseRow)}
            muted
          />
          <TotalRow label="Udgifter i alt" values={expenseTotals} tone="expense" />
        </tbody>
        <tfoot>
          <tr className="border-t border-stone-200 bg-stone-100 font-semibold">
            <td className="sticky left-0 bg-stone-100 px-3 py-2 text-left text-stone-900">
              Nettoresultat
            </td>
            {netTotals.map((value, i) => (
              <td
                key={i}
                className={`px-2 py-2 text-right ${
                  value >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatCurrency(value)}
              </td>
            ))}
            <td
              className={`px-3 py-2 text-right ${
                sum(netTotals) >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {formatCurrency(sum(netTotals))}
            </td>
          </tr>
          <tr className="bg-stone-50 text-stone-600">
            <td className="sticky left-0 bg-stone-50 px-3 py-2 text-left">
              Forventet saldo
            </td>
            {projectedBalances.map((value, i) => (
              <td
                key={i}
                className={`px-2 py-2 text-right ${
                  value >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatCurrency(value)}
              </td>
            ))}
            <td
              className={`px-3 py-2 text-right ${
                (projectedBalances.at(-1) ?? 0) >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {projectedBalances.length > 0
                ? formatCurrency(projectedBalances.at(-1)!)
                : "–"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ItemRows({
  items,
  tone,
}: {
  items: ForecastLineItem[];
  tone: "income" | "expense";
}) {
  if (items.length === 0) {
    return (
      <tr>
        <td
          colSpan={999}
          className="px-3 py-2 text-left text-xs text-stone-400"
        >
          Ingen genkendte {tone === "income" ? "indbetalinger" : "udgifter"} med
          nok historik til at projicere endnu.
        </td>
      </tr>
    );
  }

  return (
    <>
      {items.map((item) => (
        <LineRow
          key={item.key}
          label={item.label}
          values={item.months}
          total={item.total}
          tone={tone}
        />
      ))}
    </>
  );
}

function LineRow({
  label,
  values,
  total,
  tone,
  muted,
}: {
  label: string;
  values: number[];
  total: number;
  tone?: "income" | "expense";
  muted?: boolean;
}) {
  const textClass = muted
    ? "text-stone-400"
    : tone === "income"
      ? "text-green-700"
      : "text-stone-700";

  return (
    <tr className="border-b border-stone-50 last:border-0">
      <td
        className={`sticky left-0 bg-white px-3 py-1.5 text-left text-xs ${
          muted ? "text-stone-400" : "text-stone-600"
        }`}
      >
        {label}
      </td>
      {values.map((value, i) => (
        <td key={i} className={`px-2 py-1.5 text-right text-xs ${textClass}`}>
          {value > 0 ? formatCurrency(value) : "–"}
        </td>
      ))}
      <td className={`px-3 py-1.5 text-right text-xs font-medium ${textClass}`}>
        {formatCurrency(total)}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone: "income" | "expense";
}) {
  const textClass = tone === "income" ? "text-green-700" : "text-red-700";

  return (
    <tr className="border-b border-stone-200 bg-stone-100 font-medium">
      <td className="sticky left-0 bg-stone-100 px-3 py-2 text-left text-stone-900">
        {label}
      </td>
      {values.map((value, i) => (
        <td key={i} className={`px-2 py-2 text-right ${textClass}`}>
          {formatCurrency(value)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right ${textClass}`}>
        {formatCurrency(sum(values))}
      </td>
    </tr>
  );
}
