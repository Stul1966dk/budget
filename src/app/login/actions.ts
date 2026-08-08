"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowedEmails";

const emailSchema = z.object({ email: z.string().trim().email() });

export type LoginState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function requestMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { status: "error", message: "Indtast en gyldig e-mailadresse." };
  }

  const { email } = parsed.data;

  if (!isAllowedEmail(email)) {
    return {
      status: "error",
      message: "Denne e-mailadresse har ikke adgang til denne app.",
    };
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("signInWithOtp fejlede:", error.code ?? error.status, error.message);

    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        status: "error",
        message:
          "Der er sendt for mange login-links på kort tid. Vent et par minutter og prøv igen.",
      };
    }

    return {
      status: "error",
      message: "Der opstod en fejl under afsendelse af login-link. Prøv igen.",
    };
  }

  return {
    status: "success",
    message: `Vi har sendt en login-kode til ${email}. Tjek din indbakke.`,
  };
}

const verifySchema = z.object({
  email: z.string().trim().email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "Koden skal være tal fra mailen."),
});

export async function verifyLoginCode(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Indtast koden fra mailen." };
  }

  const { email, token } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    console.error("verifyOtp fejlede:", error.code ?? error.status, error.message);
    return {
      status: "error",
      message: "Koden er forkert eller udløbet. Prøv igen.",
    };
  }

  redirect("/");
}
