# Strukturregler

Gælder kun når Next.js App Router er i brug.

## Komponenter

- **Server Components som standard.** Brug kun `"use client"` når det er nødvendigt: state (`useState`), effects (`useEffect`), browser APIs, eller event handlers.
- **Gruppér feature-relateret kode.** Hold komponenter, hooks og hjælpefunktioner tæt på den feature de tilhører — ikke i globale catch-all-mapper.
- **Navngiv utility-filer beskrivende.** `formatDate.ts` frem for `utils.ts`. `useIdeas.ts` frem for `hooks.ts`.

## API og data

- **Datahentning i Server Components** når det er muligt — undgå unødvendige client-side fetches.
- **Server Actions eller API Routes** til alle data-mutationer. Aldrig direkte Supabase-kald fra client-side komponenter der muterer data.
- **Én Supabase-client per kontekst:** `lib/supabase.ts` til browser-siden, separat server-klient til Server Components og API Routes.

## Generelt

- **Klarhed over for tidlig arkitektur.** Skriv kode der er let at forstå og ændre — ikke kode der imponerer.
- **Forklar eksternt setup.** Når brugeren skal gøre noget manuelt (env vars, tredjeparts-services), beskriv det i 3-4 nummererede trin.
- **Automatisér det der kan automatiseres.** Hvis noget kan gøres via tooling, bed ikke brugeren om det.
