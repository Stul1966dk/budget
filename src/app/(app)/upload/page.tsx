import { createClient } from "@/lib/supabase/server";
import { formatDateDa } from "@/lib/format";
import type { UploadRow } from "@/lib/types/db";
import { UploadForm } from "./UploadForm";

export default async function UploadPage() {
  const supabase = await createClient();

  const [{ data: latestTransaction }, { data: latestUploadData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("uploads")
      .select("*")
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestDate = (latestTransaction?.date as string | undefined) ?? null;
  const latestUpload = (latestUploadData ?? null) as UploadRow | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900">
        Upload posteringer
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Vælg en CSV-eksport fra Danske Bank. Du ser en forhåndsvisning af de
        parsede værdier, før noget importeres.
      </p>

      <div className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
        {latestDate ? (
          <>
            <p className="text-stone-700">
              Seneste postering i appen:{" "}
              <span className="font-semibold text-stone-900">
                {formatDateDa(latestDate)}
              </span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Eksportér fra denne dato og frem. Posteringer der allerede er
              importeret, springes automatisk over som dubletter.
            </p>
          </>
        ) : (
          <p className="text-stone-700">Der er ikke importeret nogen posteringer endnu.</p>
        )}
        {latestUpload && (
          <p className="mt-1 text-xs text-stone-400">
            Seneste upload: {formatDateDa(latestUpload.uploaded_at.slice(0, 10))}
            {latestUpload.filename && ` (${latestUpload.filename})`} -{" "}
            {latestUpload.rows_imported} nye, {latestUpload.rows_skipped} dubletter
          </p>
        )}
      </div>

      <UploadForm latestDate={latestDate} />
    </div>
  );
}
