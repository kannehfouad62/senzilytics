import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantCapas } from "@/modules/capa/capa.service";
import { PermissionKey } from "@prisma/client";
import { ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

function riskClass(value: string) {
  switch (value) {
    case "LOW":
      return "border-green-400/20 bg-green-400/10 text-green-300";
    case "MEDIUM":
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";
    case "HIGH":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "CRITICAL":
      return "border-purple-400/20 bg-purple-400/10 text-purple-300";
    default:
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  }
}

type TenantCapa = Awaited<
  ReturnType<typeof findTenantCapas>
>[number];

function sourceOf(action: TenantCapa) {
  if (action.incident) {
    return {
      label: action.incident.title,
      type: "Incident",
      site: action.incident.site.name,
      href: `/incidents/${action.incident.id}`,
    };
  }

  if (action.auditFinding) {
    return {
      label: action.auditFinding.audit.title,
      type: "Audit",
      site: action.auditFinding.audit.site.name,
      href: `/audits/${action.auditFinding.audit.id}`,
    };
  }

  if (action.inspectionFinding) {
    return {
      label: action.inspectionFinding.inspection.title,
      type: "Inspection",
      site: action.inspectionFinding.inspection.site.name,
      href: `/inspections/${action.inspectionFinding.inspection.id}`,
    };
  }

  const enterpriseAuditLink =
    action.enterpriseAuditFindingLinks[0];

  if (enterpriseAuditLink) {
    return {
      label: enterpriseAuditLink.finding.audit.title,
      type: "Audit",
      site: enterpriseAuditLink.finding.audit.site.name,
      href: `/audits/${enterpriseAuditLink.finding.audit.id}`,
    };
  }

  const criticalControlVerification = action.criticalControlVerifications[0];
  if (criticalControlVerification) {
    return {
      label: criticalControlVerification.control.name,
      type: "Critical Control",
      site: "Organization-wide",
      href: `/assurance/sif/controls/${criticalControlVerification.controlId}`,
    };
  }

  const managementReviewAction = action.certificationReviewActions[0];
  if (managementReviewAction) {
    return {
      label: managementReviewAction.review.program.name,
      type: "Management Review",
      site: "Organization-wide",
      href: `/assurance/certification/reviews/${managementReviewAction.reviewId}`,
    };
  }

  const assetDefect = action.assetDefects[0];
  if (assetDefect) {
    return {
      label: `${assetDefect.asset.reference} — ${assetDefect.title}`,
      type: "Asset Defect",
      site: assetDefect.asset.site.name,
      href: `/assets/${assetDefect.assetId}`,
    };
  }

  const behaviorSession = action.behaviorSessions[0];
  if (behaviorSession) {
    return {
      label: `${behaviorSession.reference} — ${behaviorSession.program.name}`,
      type: "Behavior Coaching",
      site: behaviorSession.site.name,
      href: `/behavior-safety/sessions/${behaviorSession.id}`,
    };
  }

  const regulatoryLink = action.regulatoryChangeLinks[0];
  if (regulatoryLink) {
    return {
      label: `${regulatoryLink.change.reference} — ${regulatoryLink.change.title}`,
      type: "Regulatory Change",
      site: regulatoryLink.change.source.jurisdiction,
      href: `/compliance/regulatory/changes/${regulatoryLink.changeId}`,
    };
  }

  return {
    label: "Standalone CAPA",
    type: "Standalone",
    site: "Organization-wide",
    href: `/actions/${action.id}`,
  };
}

export default async function ActionsPage() {
  const [{ organizationId }, permissions] =
    await Promise.all([
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);

  const canCreate = permissions.includes(
    PermissionKey.CREATE_CAPA
  );
  const canAccess = [
    PermissionKey.CREATE_CAPA,
    PermissionKey.UPDATE_CAPA,
    PermissionKey.CLOSE_CAPA,
    PermissionKey.VIEW_REPORTS,
  ].some((permission) => permissions.includes(permission));

  if (!canAccess) {
    redirect("/unauthorized");
  }

  const actions = await findTenantCapas(organizationId);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ClipboardCheck size={16} />
            CAPA Management
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Corrective Actions
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Track every corrective and preventive action across incidents,
            inspections, audits, and standalone improvement work.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/actions/new"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Plus size={18} />
            New CAPA
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">Action</th>
              <th className="px-6 py-4 font-medium">Risk</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Owner</th>
              <th className="px-6 py-4 font-medium">Due Date</th>
              <th className="px-6 py-4 font-medium">Source</th>
              <th className="px-6 py-4 font-medium">Site</th>
            </tr>
          </thead>

          <tbody>
            {actions.map((action) => {
              const source = sourceOf(action);

              return (
                <tr
                  key={action.id}
                  className="border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  <td className="px-6 py-5">
                    <Link
                      href={`/actions/${action.id}`}
                      className="font-medium text-white hover:text-cyan-200"
                    >
                      {action.title}
                    </Link>
                    <p className="mt-1 line-clamp-1 max-w-md text-xs text-slate-400">
                      {action.description || "No description provided."}
                    </p>
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                        action.riskLevel
                      )}`}
                    >
                      {action.riskLevel}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                      {action.status.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-slate-300">
                    {action.assignedTo.name}
                  </td>

                  <td className="px-6 py-5 text-slate-300">
                    {action.dueDate.toLocaleDateString()}
                  </td>

                  <td className="px-6 py-5">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {source.type}
                    </p>
                    <Link
                      href={source.href}
                      className="mt-1 block text-cyan-300 hover:text-cyan-200"
                    >
                      {source.label}
                    </Link>
                  </td>

                  <td className="px-6 py-5 text-slate-300">
                    {source.site}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {actions.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No corrective actions found.
          </div>
        )}
      </div>
    </div>
  );
}
