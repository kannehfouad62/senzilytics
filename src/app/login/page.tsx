import { signIn } from "@/lib/auth";
import Link from "next/link";
import { safeLoginRedirect } from "@/lib/login-redirect";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const callbackUrl = safeLoginRedirect((await searchParams).callbackUrl);
  async function microsoftLogin(){"use server";await signIn("microsoft-entra-id",{redirectTo:callbackUrl})}
  async function oktaLogin(){"use server";await signIn("okta",{redirectTo:callbackUrl})}

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <LoginForm callbackUrl={callbackUrl} />
      <Link href="/" className="fixed left-6 top-6 text-sm text-slate-400 hover:text-cyan-300">← Senzilytics home</Link>
      <div className="fixed bottom-8 flex gap-3">{process.env.AUTH_MICROSOFT_ENTRA_ID_ID&&<form action={microsoftLogin}><button className="rounded-xl border border-white/15 bg-white/5 px-5 py-3">Sign in with Microsoft</button></form>}{process.env.AUTH_OKTA_ID&&<form action={oktaLogin}><button className="rounded-xl border border-white/15 bg-white/5 px-5 py-3">Sign in with Okta</button></form>}</div>
    </main>
  );
}
