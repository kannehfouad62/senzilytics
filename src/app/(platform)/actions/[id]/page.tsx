import { CapaCustomFormCompletion } from "@/features/capa/capa-custom-form-completion";
import { CapaStatusForm } from "@/features/capa/capa-status-form";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantCapaById } from "@/modules/capa/capa.service";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
  Status,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  ExternalLink,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

export default async function CapaDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const [
    { id },
    { organizationId, user },
    permissions,
  ] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);

  const canAccess = [
    PermissionKey.CREATE_CAPA,
    PermissionKey.UPDATE_CAPA,
    PermissionKey.CLOSE_CAPA,
    PermissionKey.VIEW_REPORTS,
  ].some((permission) =>
    permissions.includes(permission)
  );

  if (!canAccess) {
    redirect("/unauthorized");
  }

  const action =
    await findTenantCapaById(
      organizationId,
      id
    );

  if (!action) {
    notFound();
  }

  const [
    forms,
    capturedForms,
    documentUploadEnabled,
  ] = await Promise.all([
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.CAPA
    ),
    prisma.configurableFormSubmission.findMany(
      {
        where: {
          organizationId,
          entityType:
            ConfigurableFormModule.CAPA,
          entityId: action.id,
        },
        select: {
          definitionId: true,
        },
      }
    ),
    hasSubscriptionFeature(
      organizationId,
      "DOCUMENT_UPLOAD"
    ),
  ]);

  const completedDefinitionIds =
    new Set(
      capturedForms.map(
        (submission) =>
          submission.definitionId
      )
    );
  const missingForms = forms.filter(
    (form) =>
      !completedDefinitionIds.has(
        form.id
      )
  );
  const canUpdate =
    permissions.includes(
      PermissionKey.UPDATE_CAPA
    );
  const canClose =
    permissions.includes(
      PermissionKey.CLOSE_CAPA
    );
  const canUpload =
    documentUploadEnabled &&
    (canUpdate ||
      permissions.includes(
        PermissionKey.CREATE_CAPA
      ));
  const source = getCapaSource(action);
  const allowedStatuses =
    Object.values(Status).filter(
      (status) =>
        canClose ||
        (status !== Status.COMPLETED &&
          status !== Status.CLOSED)
    );

  return (
    <div>
      <Link
        href="/actions"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to corrective actions
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ClipboardCheck size={16} />
            Corrective and Preventive Action
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            {action.title}
          </h1>
          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-slate-400">
            {action.description ||
              "No description provided."}
          </p>
        </div>

        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {action.status.replaceAll(
            "_",
            " "
          )}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Risk level"
          value={action.riskLevel}
          icon={<ClipboardCheck size={18} />}
        />
        <InfoCard
          label="Assigned owner"
          value={
            action.assignedTo.name
          }
          icon={<UserRoundCheck size={18} />}
        />
        <InfoCard
          label="Due date"
          value={
            action.dueDate.toLocaleDateString()
          }
          icon={<CalendarClock size={18} />}
        />
        <InfoCard
          label="Source"
          value={source.label}
          icon={<ExternalLink size={18} />}
          href={source.href}
        />
      </div>

      {canUpdate && (
        <CapaCustomFormCompletion
          actionId={action.id}
          forms={missingForms}
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={
          ConfigurableFormModule.CAPA
        }
        entityType={
          DocumentEntityType.CORRECTIVE_ACTION
        }
        entityId={action.id}
        canUpload={canUpload}
        className="mt-8 space-y-6"
      />

      {(canUpdate || canClose) && (
        <div className="mt-8 max-w-xl">
          <CapaStatusForm
            actionId={action.id}
            currentStatus={
              action.status
            }
            allowedStatuses={
              allowedStatuses
            }
          />
        </div>
      )}
    </div>
  );
}

function getCapaSource(
  action: Awaited<
    ReturnType<
      typeof findTenantCapaById
    >
  >
) {
  if (!action) {
    return {
      label:
        "Standalone corrective action",
      href: "/actions",
    };
  }

  if (action.incident) {
    return {
      label: action.incident.title,
      href: `/incidents/${action.incident.id}`,
    };
  }

  if (action.auditFinding) {
    return {
      label:
        action.auditFinding.audit.title,
      href: `/audits/${action.auditFinding.audit.id}`,
    };
  }

  if (action.inspectionFinding) {
    return {
      label:
        action.inspectionFinding
          .inspection.title,
      href: `/inspections/${action.inspectionFinding.inspection.id}`,
    };
  }

  const enterpriseAuditLink =
    action.enterpriseAuditFindingLinks[0];

  if (enterpriseAuditLink) {
    return {
      label:
        enterpriseAuditLink.finding
          .audit.title,
      href: `/audits/${enterpriseAuditLink.finding.audit.id}`,
    };
  }

  return {
    label:
      "Standalone corrective action",
    href: "/actions",
  };
}

function InfoCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-cyan-300">
        {icon}
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-white">
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      {content}
    </div>
  );
}
