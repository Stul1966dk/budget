# Sikkerhedsregler

Gælder kun når Next.js + Supabase er i brug.

1. **RLS på alle tabeller fra dag ét.** Aktivér Row-Level Security på alle Supabase-tabeller og skriv eksplicitte policies. Ingen tabel må nogensinde have implicitte åbne adgange.

2. **`service_role`-nøglen er kun server-side.** Brug aldrig `service_role` i client-side kode eller som `NEXT_PUBLIC_`-variabel. Den hører hjemme i server actions, API routes og Edge Functions.

3. **Ingen hardcodede API-nøgler.** Alle credentials gemmes i `.env.local` (aldrig committet). `.env.local` skal altid stå i `.gitignore`.

4. **`auth.getUser()` — ikke `getSession()` — server-side.** `getSession()` stoler på client-sendte JWT-data og er ikke sikker til server-side validering.

   **Undtagelse (godkendt 2026-11-17):** Proxyen (`src/lib/supabase/middleware.ts`) bruger `getClaims()`, som verificerer tokenets signatur lokalt mod projektets asymmetriske nøgle (ES256). Det sparer et kald til Supabase ved hvert request. Prisen er, at et login lukket i Supabase virker til tokenet udløber. Proxyen styrer kun omdirigering; adgang til data afgøres af RLS. Brug stadig `getUser()` andre steder server-side.

5. **Roller og permissions tjekkes altid server-side.** Aldrig fra client state, localStorage, eller props sendt fra browseren.

6. **Explicit ownership-tjek når `service_role` bypasser RLS.** Når du bruger `service_role` til at omgå RLS, skal du manuelt verificere at brugeren ejer den ressource de tilgår.

7. **Zod-validering på alle server actions.** Alle server actions og API routes der modtager data skal validere input med Zod inden noget skrives til databasen.

8. **Webhooks: signature-verifikation med rå body.** Brug `req.text()` (ikke `req.json()`) til at læse rå body, og verificér altid webhook-signaturen inden du behandler eventet.

---

### Tre ekstra ting der ofte glemmes

- **Supabase Storage policies:** Storage buckets skal have eksplicitte policies ligesom databasetabeller — de er ikke sikre som standard.
- **`dangerouslySetInnerHTML`:** Sanitér altid med DOMPurify inden du renderer bruger-genereret HTML.
- **Rå DB-fejl til client:** Returner aldrig rå Supabase-fejlbeskeder til browseren — de kan afsløre skema-information.
