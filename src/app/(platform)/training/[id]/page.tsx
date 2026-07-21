import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { RuntimeFormCompletion } from "@/features/forms/runtime-form-completion";
import {
  completeTrainingRecordForms,
} from "@/features/training/actions";
import { TrainingCompletionForm } from "@/features/training/training-completion-form";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
  Status,
} from "@prisma/client";
import { ArrowLeft, Award, CalendarClock, GraduationCap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function TrainingRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_TRAINING);
  const [{ id }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_TRAINING);
  const record = await prisma.trainingRecord.findFirst({
    where: { id, user: { organizationId } },
    include: {
      user: true,
      course: true,
      assignedBy: true,
      requirement: true,
    },
  });

  if (!record) {
    notFound();
  }

  const [forms, capturedForms, documentUploadEnabled] = await Promise.all([
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.TRAINING
    ),
    prisma.configurableFormSubmission.findMany({
      where: {
        organizationId,
        entityType: ConfigurableFormModule.TRAINING,
        entityId: record.id,
      },
      select: { definitionId: true },
    }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  const capturedIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingForms = forms.filter((form) => !capturedIds.has(form.id));

  return (
    <div>
      <Link
        href="/training"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to training
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <GraduationCap size={17} />
            Training Assignment
          </p>
          <h1 className="mt-2 text-4xl font-bold">{record.courseName}</h1>
          <p className="mt-2 text-slate-400">Assigned to {record.user.name}</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {record.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Learner" value={record.user.name} />
        <InfoCard
          label="Due date"
          value={record.dueDate?.toLocaleDateString() || "No due date"}
        />
        <InfoCard
          label="Assigned by"
          value={record.assignedBy?.name || "Automated requirement"}
        />
        <InfoCard label="Provider" value={record.provider || "Internal"} />
      </div>

      {canManage && (
        <RuntimeFormCompletion
          action={completeTrainingRecordForms}
          entityId={record.id}
          entityIdName="trainingRecordId"
          forms={missingForms}
          submitLabel="Save Training Forms"
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={ConfigurableFormModule.TRAINING}
        entityType={DocumentEntityType.TRAINING}
        entityId={record.id}
        canUpload={canManage && documentUploadEnabled}
        className="mt-8 space-y-6"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Award size={20} className="text-cyan-300" />
            Completion record
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail
              label="Completed"
              value={record.completedAt?.toLocaleDateString() || null}
            />
            <Detail
              label="Expires"
              value={record.expiresAt?.toLocaleDateString() || null}
            />
            <Detail label="Certificate" value={record.certificateNumber} />
            <Detail
              label="Score"
              value={record.score === null ? null : String(record.score)}
            />
            <Detail label="Notes" value={record.notes} />
          </dl>
        </section>

        {canManage && record.status !== Status.COMPLETED && <TrainingCompletionForm recordId={record.id} />}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <CalendarClock size={18} className="text-cyan-300" />
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-slate-200">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
