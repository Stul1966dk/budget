# Budget

Privat husholdningsbudget-app til en dansk husstand (Stig + Charlotte). Du
uploader hver måned en CSV-eksport fra Danske Bank, og appen giver et
overskueligt overblik over indtægter og udgifter. Kryptiske posteringstekster
kan beriges med kommentar og kategori - og den berigelse huskes automatisk
til fremtidige uploads via mapping-regler.

## Tech-stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript) - se note nedenfor
- [Supabase](https://supabase.com) (Postgres + Auth via magic link)
- Tailwind CSS
- Papaparse (CSV-parsing) og Zod (validering)
- Vitest (tests)

> **Note om Next.js-version:** Specifikationen bad om Next.js 15, men
> `create-next-app@latest` installerede Next.js 16 på opsætningstidspunktet.
> App Router-mønstrene er de samme, så koden er skrevet mod Next.js 16 (bl.a.
> hedder route-beskyttelsesfilen `src/proxy.ts` - Next.js 16's nye navn for
> det der tidligere hed `middleware.ts`).

## Arkitektur i korte træk

- Alt data ligger i sit eget Postgres-schema, `budget`, ikke i `public` -
  Supabase-projektet "projekter" skal kunne huse flere uafhængige apps over
  tid.
- Row-Level Security er slået til på alle tabeller. Kun de to whitelistede
  e-mails (`ALLOWED_EMAILS`) har adgang, håndhævet både i appen (før der
  sendes magic link) og i databasen (RLS-policies tjekker `auth.jwt() ->>
  'email'`).
- Data er fælles for husstanden - ikke adskilt pr. bruger.
- CSV-parseren (`src/lib/csv/`) og mapping-motoren (`src/lib/mapping/`) er
  rene, testede funktioner uden database-afhængighed.

## Opsætning af Supabase-projektet

1. **Opret projektet** (hvis ikke allerede gjort) på [supabase.com](https://supabase.com).
   Projektet i denne opsætning hedder `projekter` og kan indeholde flere
   apps i fremtiden - Budget-appen bruger udelukkende sit eget schema.

2. **Kør migrationen.** Åbn SQL Editor i Supabase-dashboardet og indsæt
   indholdet af [`supabase/migrations/20260731120000_init_budget_schema.sql`](supabase/migrations/20260731120000_init_budget_schema.sql),
   og tryk *Run*. Det opretter schemaet `budget`, alle tabeller,
   RLS-policies og seed-data (standardkategorier og mapping-regler for
   interne overførsler).

   Hvis du foretrækker Supabase CLI: `supabase db push` (kræver at projektet
   er linket med `supabase link`).

3. **Eksponér schemaet.** Gå til **Project Settings → API → Exposed
   schemas** og tilføj `budget` til listen (ellers kan appen ikke tilgå
   tabellerne via Supabase-klienten). `public` skal ikke fjernes, da andre
   fremtidige apps kan bruge det.

4. **Slå magic link-login til.** Under **Authentication → Providers** skal
   Email-provideren være aktiveret. Under **Authentication → URL
   Configuration** skal du tilføje din lokale og senere din Vercel-URL til
   *Redirect URLs*, fx `http://localhost:3000/auth/callback` og
   `https://dit-domæne.vercel.app/auth/callback`.

5. **Find dine nøgler.** Under **Project Settings → API Keys** finder du:
   - Project URL
   - `sb_publishable_...` (det nye navn for anon key)
   - `sb_secret_...` (det nye navn for service_role key - **kun** til
     server-side brug, deles aldrig i klient-kode eller chat)

## Miljøvariabler

Kopiér `.env.example` til `.env.local` og udfyld:

```bash
cp .env.example .env.local
```

| Variabel | Beskrivelse |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-projektets URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...`-nøgle, bruges klient-side |
| `SUPABASE_SECRET_KEY` | `sb_secret_...`-nøgle, kun server-side. Bruges ikke af v1-koden endnu, men er forberedt til v2 (AI-analyse) |
| `ALLOWED_EMAILS` | Kommasepareret liste over de eneste e-mails der må logge ind |

## Lokal kørsel

```bash
npm install
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000). Første login sker via
magic link til en af de whitelistede e-mails.

## Tests

CSV-parseren, mapping-motoren og månedslogikken har unit-tests, da det er de
mest fejlfølsomme dele (encoding, dansk talformat, datoer, dublet-hash,
regel-matching).

```bash
npm run test
```

## Deployment til Vercel

1. Push repoet til GitHub (eller et andet Git-hosting Vercel understøtter).
2. Opret et nyt Vercel-projekt ud fra repoet.
3. Tilføj de samme miljøvariabler som i `.env.local` under **Project
   Settings → Environment Variables**.
4. Tilføj Vercel-domænet til Supabase's *Redirect URLs* (se trin 4 ovenfor),
   ellers fejler magic link-loginet i produktion.
5. Deploy.

## Uden for scope i v1

- Budget-forecast/AI-rådgivning (v2) - `SUPABASE_SECRET_KEY` er allerede
  forberedt til dette, og datamodellen er holdt simpel med henblik på det.
- Flere konti/kontotyper.
- Offline-funktionalitet (appen er installérbar som PWA, men kræver online
  forbindelse til Supabase).

## Manuelle trin du selv skal udføre

- [ ] Kør migrationsfilen `supabase/migrations/20260731120000_init_budget_schema.sql` i Supabase SQL Editor.
- [ ] Tilføj `budget` til **Exposed schemas** under Project Settings → API.
- [ ] Aktivér Email-provideren under Authentication → Providers (hvis ikke allerede aktiv).
- [ ] Tilføj redirect-URLs (`/auth/callback`) under Authentication → URL Configuration - både din lokale URL og senere din Vercel-URL.
- [ ] Indsæt `SUPABASE_SECRET_KEY` i `.env.local` (gjort).
- [ ] Ved deployment: opret Vercel-projekt, tilføj miljøvariabler, og tilføj Vercel-domænet som redirect-URL i Supabase.
