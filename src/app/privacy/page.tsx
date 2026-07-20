import Link from "next/link";

export default function PrivacyPolicyPage() {
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white sm:px-8"><article className="mx-auto max-w-4xl"><Link href="/" className="text-sm text-cyan-300">← Back to Senzilytics</Link><p className="mt-10 text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Privacy and data protection</p><h1 className="mt-3 text-4xl font-bold">Privacy Policy</h1><p className="mt-3 text-sm text-slate-500">Last updated July 20, 2026</p><div className="mt-10 space-y-8 text-slate-300">
    <Section title="Information we collect">When you request a demonstration or communicate with us, we may collect your name, work email, company, job title, country, communication preferences, and technical information needed to secure and operate the service.</Section>
    <Section title="How we use information">We use this information to provide the requested demonstration, protect the platform, respond to inquiries, improve Senzilytics, and—where you have agreed—send relevant product or educational information.</Section>
    <Section title="Demo data">The interactive demo uses fictional organizational records. Demo visitors must not enter confidential, sensitive, regulated, or customer operational data into the demonstration environment.</Section>
    <Section title="Sharing and service providers">We may use carefully selected service providers for hosting, authentication, email delivery, security, and analytics. We do not sell personal information. Providers may process information only to deliver services to Senzilytics and under appropriate safeguards.</Section>
    <Section title="Security and retention">We use organizational and technical safeguards designed to protect information. Demo access is time limited. Lead and consent records are retained only as long as reasonably needed for business, security, legal, and compliance purposes.</Section>
    <Section title="Your choices and rights">You can decline optional topic updates. You may request access, correction, deletion, or withdrawal of marketing consent, subject to applicable law and legitimate retention requirements.</Section>
    <Section title="Contact us">For privacy questions or requests, email <a className="text-cyan-300 underline" href="mailto:privacy@senzilytics.com">privacy@senzilytics.com</a>.</Section>
  </div></article></main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-3 leading-7">{children}</p></section>; }
