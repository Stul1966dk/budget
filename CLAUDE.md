@docs/regler/sikkerhed.md
@docs/regler/struktur.md

Reglerne ovenfor gælder kun når de relevante teknologier er i brug. Tilføj projektspecifik kontekst herunder — og bevar referencerne ovenfor så de indlæses i fremtidige sessioner.

---

## Projekt: Budget

Privat husholdningsbudget-webapp til en dansk husstand (2 brugere). Brugeren uploader en månedlig CSV-eksport fra Danske Bank, og appen viser en overskuelig oversigt over udgifter og indtægter, med en mapping-motor der husker kategoriseringer af posteringstekster på tværs af uploads.

Stack: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth via magic link), Tailwind CSS, Papaparse. Deployes til Vercel.
