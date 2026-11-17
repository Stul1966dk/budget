import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "budget" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() tjekker login-tokenets signatur lokalt mod Supabase's
  // offentlige nøgle (ES256) i stedet for at spørge Supabase ved hvert
  // request som getUser() - det sparer ca. 150 ms pr. faneskift. Udløbne
  // tokens fornyes stadig her. Bevidst undtagelse fra sikkerhedsregel 4
  // (se docs/regler/sikkerhed.md): et login, der er lukket i Supabase, virker
  // indtil tokenet udløber. Proxyen styrer kun omdirigering til login - selve
  // adgangen til data afgøres af RLS i databasen.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
