import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";

    await signIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirectTo: "/dashboard",
    });

    redirect("/dashboard");
  }
  async function microsoftLogin(){"use server";await signIn("microsoft-entra-id",{redirectTo:"/dashboard"})}
  async function oktaLogin(){"use server";await signIn("okta",{redirectTo:"/dashboard"})}

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <form
        action={login}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
      >
        <p className="text-sm text-cyan-300">Senzilytics Secure Access</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>

        <div className="mt-8 space-y-5">
          <input
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Sign In
          </button>
          <Link href="/forgot-password" className="block text-center text-sm text-cyan-300">Forgot password?</Link>
          <div className="border-t border-white/10 pt-5 text-center text-sm text-slate-400">
            Evaluating Senzilytics? <Link href="/demo" className="font-medium text-cyan-300">Try the interactive demo</Link>
          </div>
        </div>
      </form>
      <Link href="/" className="fixed left-6 top-6 text-sm text-slate-400 hover:text-cyan-300">← Senzilytics home</Link>
      <div className="fixed bottom-8 flex gap-3">{process.env.AUTH_MICROSOFT_ENTRA_ID_ID&&<form action={microsoftLogin}><button className="rounded-xl border border-white/15 bg-white/5 px-5 py-3">Sign in with Microsoft</button></form>}{process.env.AUTH_OKTA_ID&&<form action={oktaLogin}><button className="rounded-xl border border-white/15 bg-white/5 px-5 py-3">Sign in with Okta</button></form>}</div>
    </main>
  );
}
