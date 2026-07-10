import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

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
            defaultValue="admin@senzilytics.com"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <input
            name="password"
            type="password"
            required
            defaultValue="Admin@12345"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Sign In
          </button>
        </div>
      </form>
    </main>
  );
}