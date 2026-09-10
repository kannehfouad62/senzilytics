import { PermissionKey, ResearchDashboardStatus } from "@prisma/client";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchDashboardBuilder } from "@/features/research/dashboard-builder";
import { ResearchDashboardGovernance } from "@/features/research/dashboard-governance";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  normalizeDashboardBranding,
  normalizeDashboardLayout,
} from "@/modules/research/research-dashboard";

export const dynamic = "force-dynamic";
const transitions: Record<ResearchDashboardStatus, ResearchDashboardStatus[]> =
  {
    DRAFT: [ResearchDashboardStatus.UNDER_REVIEW],
    UNDER_REVIEW: [
      ResearchDashboardStatus.DRAFT,
      ResearchDashboardStatus.APPROVED,
    ],
    APPROVED: [ResearchDashboardStatus.ARCHIVED],
    ARCHIVED: [],
  };
export default async function ResearchDashboardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, { organizationId }, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const project = await prisma.researchProject.findFirst({
    where: { id, organizationId },
    include: { client: true },
  });
  if (!project) notFound();
  const [analyses, dashboards] = await Promise.all([
    prisma.researchAnalysis.findMany({
      where: {
        organizationId,
        OR: [
          { collection: { projectId: id } },
          { datasetVersion: { dataset: { projectId: id } } },
        ],
      },
      select: { id: true, title: true, method: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.researchVisualizationDashboard.findMany({
      where: { organizationId, projectId: id },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const canBuild = permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS),
    canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS);
  return (
    <div>
      <Link
        href={`/research/projects/${id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Research project
      </Link>
      <div className="mt-6 flex items-start gap-3">
        <LayoutDashboard className="mt-1 text-cyan-300" />
        <div>
          <p className="text-sm text-cyan-300">
            Phase 5 visualization governance
          </p>
          <h1 className="mt-1 text-4xl font-bold">Research dashboards</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Compose, brand, review, and approve multi-analysis dashboards for{" "}
            {project.reference} · {project.title}.
          </p>
        </div>
      </div>
      {canBuild && (
        <div className="mt-8">
          <ResearchDashboardBuilder
            projectId={id}
            analyses={analyses}
            defaultBrand={project.client?.name ?? project.title}
          />
        </div>
      )}
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Saved dashboard layouts</h2>
        {dashboards.map((dashboard) => {
          const allowed = new Set(analyses.map((item) => item.id)),
            layout = normalizeDashboardLayout(
              dashboard.layoutDefinition,
              allowed,
            ),
            branding = normalizeDashboardBranding(
              dashboard.branding,
              project.title,
            ),
            next = transitions[dashboard.status].filter(
              (status) =>
                status !== ResearchDashboardStatus.APPROVED || canApprove,
            );
          return (
            <article
              key={dashboard.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]"
            >
              <div
                className="h-2"
                style={{
                  background: `linear-gradient(90deg,${branding.primaryColor},${branding.accentColor})`,
                }}
              />
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-[.16em]"
                      style={{ color: branding.primaryColor }}
                    >
                      {branding.brandName}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {dashboard.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {dashboard.description ||
                        "Saved research intelligence layout"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
                    {dashboard.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div
                  className={`mt-5 grid gap-3 ${layout.columns === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}
                >
                  {layout.widgets.map((widget) => (
                    <div
                      key={widget.analysisId}
                      className={`${widget.width === "FULL" ? "md:col-span-2" : ""} rounded-2xl border border-white/10 bg-slate-950/45 p-4`}
                    >
                      <p className="font-semibold">{widget.title}</p>
                      {widget.annotation && (
                        <p className="mt-2 text-sm text-slate-400">
                          {widget.annotation}
                        </p>
                      )}
                      {widget.referenceLine !== undefined && (
                        <p className="mt-3 text-xs text-amber-300">
                          Reference line · {widget.referenceLine}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Created by {dashboard.createdBy.name}
                    {dashboard.approvedBy
                      ? ` · Approved by ${dashboard.approvedBy.name}`
                      : ""}
                    {branding.footerText ? ` · ${branding.footerText}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {dashboard.status === ResearchDashboardStatus.APPROVED &&
                      (["svg", "png", "pdf"] as const).map((format) => (
                        <a
                          key={format}
                          href={`/api/research/dashboards/${dashboard.id}/export?format=${format}`}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs uppercase text-slate-300"
                        >
                          {format}
                        </a>
                      ))}
                    {next.length > 0 && (
                      <ResearchDashboardGovernance
                        dashboardId={dashboard.id}
                        next={next}
                      />
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!dashboards.length && (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No saved visualization dashboards yet.
          </div>
        )}
      </section>
    </div>
  );
}
