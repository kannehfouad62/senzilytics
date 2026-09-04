import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import { PublicResearchSurveyForm } from "@/features/research/public-survey-forms";
import { prisma } from "@/lib/prisma";
import {
  ResearchCollectionStatus,
  ResearchPublicLinkStatus,
} from "@prisma/client";
import {
  deterministicFieldOrder,
  resumeCookieName,
} from "@/modules/research/research-response-integrity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Research Survey | Senzilytics",
  robots: { index: false, follow: false },
};

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const link = await prisma.researchPublicSurveyLink.findUnique({
    where: { token },
    include: {
      collection: {
        include: {
          project: { include: { client: true } },
          questionnaire: true,
          formVersion: {
            include: { fields: { orderBy: { sequence: "asc" } } },
          },
        },
      },
      _count: { select: { responses: true } },
    },
  });
  const now = new Date();
  const unavailable =
    !link ||
    link.status !== ResearchPublicLinkStatus.ACTIVE ||
    link.collection.status !== ResearchCollectionStatus.ACTIVE ||
    Boolean(link.expiresAt && link.expiresAt < now) ||
    Boolean(link.collection.opensAt && link.collection.opensAt > now) ||
    Boolean(link.collection.closesAt && link.collection.closesAt < now) ||
    Boolean(
      link.maxResponses !== null && link._count.responses >= link.maxResponses,
    );
  if (!link || unavailable)
    return (
      <SurveyShell>
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[.05] p-8 text-center">
          <h1 className="text-3xl font-bold">Survey unavailable</h1>
          <p className="mt-3 text-slate-300">
            This survey is not currently accepting responses. Please contact the
            research team if you believe this is unexpected.
          </p>
        </section>
      </SurveyShell>
    );

  const invitation = query.invite
    ? await prisma.researchSurveyInvitation.findFirst({
        where: {
          token: query.invite,
          campaign: { publicLinkId: link.id, status: "ACTIVE" },
          status: { in: ["SENT", "OPENED"] },
        },
      })
    : null;
  if (query.invite && !invitation)
    return (
      <SurveyShell>
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[.05] p-8 text-center">
          <h1 className="text-3xl font-bold">Invitation unavailable</h1>
          <p className="mt-3 text-slate-300">
            This invitation is invalid, completed, or no longer active.
          </p>
        </section>
      </SurveyShell>
    );
  if (invitation?.status === "SENT")
    await prisma.researchSurveyInvitation.updateMany({
      where: { id: invitation.id, status: "SENT" },
      data: { status: "OPENED", openedAt: new Date() },
    });

  const jar = await cookies();
  const resumeToken = jar.get(resumeCookieName(token))?.value;
  const savedSession = resumeToken
    ? await prisma.researchPublicSurveySession.findFirst({
        where: {
          resumeTokenHash: createHash("sha256")
            .update(resumeToken)
            .digest("hex"),
          publicLinkId: link.id,
          formVersionId: link.collection.formVersionId,
          completedAt: null,
          expiresAt: { gt: now },
          invitationId: invitation?.id ?? null,
        },
      })
    : null;

  const collection = link.collection;
  const orderingSeed = invitation?.token ?? resumeToken ?? token;
  const fields = link.randomizeQuestions
    ? deterministicFieldOrder(collection.formVersion.fields, orderingSeed)
    : collection.formVersion.fields;
  const form = {
    id: collection.questionnaire.formDefinitionId,
    name: collection.questionnaire.name,
    description: collection.questionnaire.purpose,
    version: { ...collection.formVersion, fields },
  };
  const initialValues = jsonRecord(savedSession?.answers);
  const initialIdentity = jsonRecord(savedSession?.identity);
  return (
    <SurveyShell>
      <header className="mb-8">
        <p className="text-sm font-semibold text-cyan-300">
          {collection.project.client?.name ?? collection.project.title}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {collection.questionnaire.name}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-300">
          {collection.questionnaire.purpose}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            {collection.questionnaire.identityMode.replaceAll("_", " ")}{" "}
            responses
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">
            Questionnaire v{collection.formVersion.version}
          </span>
        </div>
        {collection.instructions && (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300">
            {collection.instructions}
          </p>
        )}
      </header>
      <PublicResearchSurveyForm
        token={token}
        identityMode={collection.questionnaire.identityMode}
        consentStatement={collection.questionnaire.consentStatement}
        form={form}
        invitationToken={invitation?.token ?? null}
        invitedName={invitation?.participantName ?? null}
        invitedEmail={invitation?.participantEmail ?? null}
        allowSaveResume={link.allowSaveResume}
        initialValues={initialValues}
        initialIdentity={{
          participantName: stringOrNull(initialIdentity.participantName),
          participantEmail: stringOrNull(initialIdentity.participantEmail),
          pseudonymousReference: stringOrNull(
            initialIdentity.pseudonymousReference,
          ),
        }}
      />
    </SurveyShell>
  );
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string | string[] | boolean>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function SurveyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.13),transparent_32rem),linear-gradient(145deg,#071421,#030712)] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-3">
          <Image
            src="/brand/senzilytics-mark.png"
            alt=""
            width={42}
            height={42}
            className="rounded-xl"
          />
          <span>
            <strong className="block">Senzilytics</strong>
            <span className="text-xs text-slate-400">
              Governed Research Collection
            </span>
          </span>
        </Link>
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl sm:p-9">
          {children}
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">
          Secure research collection powered by Senzilytics.
        </p>
      </div>
    </main>
  );
}
