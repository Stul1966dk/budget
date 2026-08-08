"use client";

import { useActionState, useEffect, useState } from "react";
import { requestMagicLink, verifyLoginCode, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");

  const [emailState, emailAction, emailPending] = useActionState(
    requestMagicLink,
    initialState,
  );
  const [codeState, codeAction, codePending] = useActionState(
    verifyLoginCode,
    initialState,
  );

  useEffect(() => {
    if (emailState.status === "success") {
      setPhase("code");
    }
  }, [emailState]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-forest-900">Budget</h1>
        <p className="mt-1 text-sm text-stone-500">
          {phase === "email"
            ? "Log ind med din e-mail for at se husstandens budget."
            : `Indtast koden vi sendte til ${email}.`}
        </p>

        {phase === "email" ? (
          <form action={emailAction} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="dig@example.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={emailPending}
              className="w-full rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800 disabled:opacity-50"
            >
              {emailPending ? "Sender..." : "Send kode"}
            </button>

            {emailState.status === "error" && (
              <p role="alert" className="text-sm text-red-600">
                {emailState.message}
              </p>
            )}
          </form>
        ) : (
          <form action={codeAction} className="mt-6 space-y-4">
            <input type="hidden" name="email" value={email} />

            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-stone-700"
              >
                Kode
              </label>
              <input
                id="token"
                name="token"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{4,10}"
                maxLength={10}
                required
                autoFocus
                placeholder="Koden fra mailen"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-center text-lg tracking-[0.2em] text-stone-900 focus:border-stone-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={codePending}
              className="w-full rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-800 disabled:opacity-50"
            >
              {codePending ? "Bekræfter..." : "Bekræft kode"}
            </button>

            {codeState.status === "error" && (
              <p role="alert" className="text-sm text-red-600">
                {codeState.message}
              </p>
            )}

            <button
              type="button"
              onClick={() => setPhase("email")}
              className="w-full text-center text-xs text-stone-400 hover:text-stone-600"
            >
              Skift e-mail eller send koden igen
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
