"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

function CallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth") return null;

  return (
    <p role="alert" className="text-sm text-red-600">
      Login-linket kunne ikke bruges. Det kan skyldes at det allerede er
      brugt, er udløbet, eller blev åbnet i en anden browser end den du
      loggede ind fra. Prøv at få tilsendt et nyt link.
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    requestMagicLink,
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Budget</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log ind med din e-mail for at se husstandens budget.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Sender..." : "Send login-link"}
          </button>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p role="status" className="text-sm text-green-600">
              {state.message}
            </p>
          )}
          {state.status === "idle" && (
            <Suspense fallback={null}>
              <CallbackError />
            </Suspense>
          )}
        </form>
      </div>
    </main>
  );
}
