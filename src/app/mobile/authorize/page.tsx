import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Smartphone, ShieldCheck } from "lucide-react";
import { MobileAuthorizationForm } from "@/features/mobile/mobile-authorization-form";
import { getMobileAuthorizationEligibilityService, getMobileChallengeService } from "@/modules/mobile/mobile-auth.service";

export const dynamic = "force-dynamic";

export default async function MobileAuthorizePage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const challenge = String((await searchParams).challenge || "");
  const record = await getMobileChallengeService(challenge);
  if (!record || record.expiresAt <= new Date() || record.usedAt || record.authorizedAt) return <Message title="Authorization expired" detail="Return to the Senzilytics mobile app and begin sign-in again." />;
  const session = await auth();
  if (!session?.user || !session.user.sessionValid) redirect(`/login?callbackUrl=${encodeURIComponent(`/mobile/authorize?challenge=${challenge}`)}`);
  const eligibility = await getMobileAuthorizationEligibilityService(session.user.id);
  if (!eligibility.eligible) return <Message title={eligibility.title} detail={eligibility.detail} />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><section className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-white/[.05] p-8 shadow-2xl"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Smartphone /></div><p className="mt-6 text-sm text-cyan-300">Premium native access</p><h1 className="mt-2 text-3xl font-bold">Authorize Senzilytics Mobile</h1><p className="mt-4 leading-7 text-slate-400">The mobile app is requesting access as <span className="font-medium text-white">{session.user.email}</span>. Your organization, role, permissions, and SSO policy remain enforced by Senzilytics.</p><div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200"><ShieldCheck size={17} className="mr-2 inline" />The app will receive a device-bound session. Your password and identity-provider credentials are never shared with it.</div><MobileAuthorizationForm challenge={challenge} /></section></main>;
}

function Message({ title, detail }: { title: string; detail: string }) { return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><section className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-slate-400">{detail}</p></section></main>; }
