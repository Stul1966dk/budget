"use client";

import { Fragment, useState } from "react";
import { formatCurrency } from "@/lib/format";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

export type YearTableItem = {
  key: string;
  label: string;
  months: number[];
  total: number;
};

export type YearTableCategory = {
  key: string;
  name: string;
  months: number[];
  total: number;
  items: YearTableItem[];
};

export function YearTable({
  rows,
  monthTotals,
  grandTotal,
  monthlyBalances,
}: {
  rows: YearTableCategory[];
  monthTotals: number[];
  grandTotal: number;
  monthlyBalances: (number | null)[];
}) {
  const latestKnownBalance = [...monthlyBalances].reverse().find((v) => v !== null) ?? null;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandableKeys = rows.filter((r) => r.items.length > 0).map((r) => r.key);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setExpanded(new Set(expandableKeys))}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          Fold alle ud
        </button>
        <button
          type="button"
          onClick={() => setExpanded(new Set())}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          Fold alle sammen
        </button>
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
              <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium">
                Kategori
              </th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expanded.has(row.key);
              const hasItems = row.items.length > 0;

              return (
                <Fragment key={row.key}>
                  <tr className="border-b border-stone-100 last:border-0">
                    <td className="sticky left-0 bg-white px-3 py-2 text-left text-stone-700">
                      <button
                        type="button"
                        onClick={() => hasItems && toggle(row.key)}
                        disabled={!hasItems}
                        className="flex w-full items-center gap-1.5 text-left disabled:cursor-default"
                      >
                        <span className="w-3 shrink-0 text-xs text-stone-400">
                          {hasItems ? (isExpanded ? "▾" : "▸") : ""}
                        </span>
                        {row.name}
                      </button>
                    </td>
                    {row.months.map((value, i) => (
                      <td key={i} className="px-2 py-2 text-right text-stone-600">
                        {value > 0 ? formatCurrency(value) : "–"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium text-stone-900">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                  {isExpanded &&
                    row.items.map((item) => (
                      <tr
                        key={item.key}
                        className="border-b border-stone-50 bg-stone-100 last:border-0"
                      >
                        <td className="sticky left-0 bg-stone-100 py-1.5 pl-9 pr-3 text-left text-xs text-stone-500">
                          {item.label}
                        </td>
                        {item.months.map((value, i) => (
                          <td
                            key={i}
                            className="px-2 py-1.5 text-right text-xs text-stone-500"
                          >
                            {value > 0 ? formatCurrency(value) : "–"}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right text-xs font-medium text-stone-600">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-medium text-stone-900">
              <td className="sticky left-0 bg-white px-3 py-2 text-left">Total</td>
              {monthTotals.map((value, i) => (
                <td key={i} className="px-2 py-2 text-right">
                  {value > 0 ? formatCurrency(value) : "–"}
                </td>
              ))}
              <td className="px-3 py-2 text-right">{formatCurrency(grandTotal)}</td>
            </tr>
            <tr className="bg-stone-50 text-stone-600">
              <td className="sticky left-0 bg-stone-50 px-3 py-2 text-left">Saldo</td>
              {monthlyBalances.map((value, i) => (
                <td
                  key={i}
                  className={`px-2 py-2 text-right ${
                    value === null
                      ? ""
                      : value >= 0
                        ? "text-green-700"
                        : "text-red-700"
                  }`}
                >
                  {value !== null ? formatCurrency(value) : "–"}
                </td>
              ))}
              <td
                className={`px-3 py-2 text-right ${
                  latestKnownBalance === null
                    ? ""
                    : latestKnownBalance >= 0
                      ? "text-green-700"
                      : "text-red-700"
                }`}
              >
                {latestKnownBalance !== null ? formatCurrency(latestKnownBalance) : "–"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
