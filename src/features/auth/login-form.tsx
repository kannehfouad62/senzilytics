"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialLoginActionState,
  loginWithCredentials,
} from "@/features/auth/login.actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(
    loginWithCredentials,
    initialLoginActionState
  );

  return (
    <form
      action={action}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <p className="text-sm text-cyan-300">Senzilytics Secure Access</p>
      <h1 className="mt-2 text-3xl font-bold">Sign in</h1>

      <div className="mt-8 space-y-5">
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@company.com"
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />

        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password"
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />

        {state.message ? (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in securely…" : "Sign In"}
        </button>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-cyan-300"
        >
          Forgot password?
        </Link>
        <div className="border-t border-white/10 pt-5 text-center text-sm text-slate-400">
          Evaluating Senzilytics?{" "}
          <Link href="/demo" className="font-medium text-cyan-300">
            Try the interactive demo
          </Link>
        </div>
      </div>
    </form>
  );
}
