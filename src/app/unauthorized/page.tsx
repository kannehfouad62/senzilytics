import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-center shadow-2xl">
        <p className="text-sm text-red-300">Access Restricted</p>
        <h1 className="mt-2 text-3xl font-bold">Unauthorized</h1>
        <p className="mt-4 text-slate-300">
          You do not have permission to access this area.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}