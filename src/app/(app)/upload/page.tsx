"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { parseDanskeBankFile } from "@/lib/csv/parseDanskeBank";
import type { ParseResult } from "@/lib/csv/types";
import { formatCurrency, formatDateDa } from "@/lib/format";
import { importCsvFile, type ImportResult } from "./actions";

const PREVIEW_ROW_LIMIT = 15;

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function loadFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    setPreview(parseDanskeBankFile(buffer));
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !inputRef.current) return;
    inputRef.current.files = event.dataTransfer.files;
    void loadFile(file);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await importCsvFile(formData);
      setResult(res);
      if (res.status === "success") {
        setPreview(null);
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">
        Upload posteringer
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Vælg en CSV-eksport fra Danske Bank. Du ser en forhåndsvisning af de
        parsede værdier, før noget importeres.
      </p>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <label
          htmlFor="file"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDraggingOver
              ? "border-stone-500 bg-stone-100"
              : "border-stone-300 bg-white hover:border-stone-400"
          }`}
        >
          <span className="text-sm font-medium text-stone-700">
            {fileName ?? "Klik for at vælge en fil, eller træk den hertil"}
          </span>
          <span className="mt-1 text-xs text-stone-400">
            CSV-fil fra Danske Bank
          </span>
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
            }}
            className="sr-only"
          />
        </label>

        {preview && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-600">
              {preview.rows.length} rækker fundet
              {preview.errors.length > 0 &&
                `, ${preview.errors.length} kunne ikke læses`}
              .
            </p>

            {preview.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                {preview.errors.slice(0, 5).map((err) => (
                  <li key={err.rowNumber}>
                    Linje {err.rowNumber}: {err.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-stone-400">
                    <th className="py-1 pr-3 font-medium">Dato</th>
                    <th className="py-1 pr-3 font-medium">Tekst</th>
                    <th className="py-1 pr-3 text-right font-medium">
                      Beløb
                    </th>
                    <th className="py-1 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
                    <tr key={row.rowHash} className="border-t border-stone-100">
                      <td className="whitespace-nowrap py-1.5 pr-3 text-stone-600">
                        {formatDateDa(row.date)}
                      </td>
                      <td className="py-1.5 pr-3 text-stone-900">
                        {row.rawText}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-right text-stone-500">
                        {row.balance !== null
                          ? formatCurrency(row.balance)
                          : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > PREVIEW_ROW_LIMIT && (
              <p className="mt-2 text-xs text-stone-400">
                ... og {preview.rows.length - PREVIEW_ROW_LIMIT} flere rækker
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!preview || preview.rows.length === 0 || isPending}
          className="w-full rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-800 disabled:opacity-50"
        >
          {isPending ? "Importerer..." : "Importér"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            result.status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.status === "success" ? (
            <>
              <p>
                {result.rowsImported} nye posteringer importeret,{" "}
                {result.rowsSkipped} dubletter sprunget over.
              </p>
              {result.parseErrors && result.parseErrors.length > 0 && (
                <p className="mt-1 text-amber-700">
                  {result.parseErrors.length} linjer kunne ikke læses og blev
                  sprunget over.
                </p>
              )}
              {(result.rowsImported ?? 0) > 0 && (
                <Link
                  href="/?filter=umatchede"
                  className="mt-2 inline-block font-medium underline"
                >
                  Gennemgå nye umatchede posteringer
                </Link>
              )}
              {result.alertMessages && result.alertMessages.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <p className="font-medium">Bemærk:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {result.alertMessages.map((message, i) => (
                      <li key={i}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
