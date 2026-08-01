import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError) {
    console.error("auth/callback: Supabase-fejl før code-exchange:", authError);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("auth/callback: exchangeCodeForSession fejlede:", error.code ?? error.status, error.message);
  } else if (!authError) {
    console.error("auth/callback: intet 'code'-parameter i request:", request.url);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
