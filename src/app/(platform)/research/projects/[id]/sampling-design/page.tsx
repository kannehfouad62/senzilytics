import { PermissionKey, ResearchSamplingDesignStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SamplingDesignForm,
  SamplingDesignStatusControl,
} from "@/features/research/sampling-design-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export default async function SamplingDesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, { organizationId, user }, permissions] = await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]),
    project = await prisma.researchProject.findFirst({
      where: { id, organizationId },
      include: {
        samplingDesigns: {
          include: {
            createdBy: { select: { name: true } },
            approvedBy: { select: { name: true } },
          },
          orderBy: { version: "desc" },
        },
      },
    });
  if (!project) notFound();
  const canManage = permissions.includes(
      PermissionKey.MANAGE_RESEARCH_PROJECTS,
    ),
    canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS);
  return (
    <div>
      <Link href={`/research/projects/${id}`} className="text-sm text-cyan-300">
        ← {project.reference}
      </Link>
      <div className="mt-5">
        <p className="text-sm text-cyan-300">Survey methodology governance</p>
        <h1 className="mt-2 text-4xl font-bold">Sampling Design Register</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Version, review and independently approve the sampling frame,
          selection procedure, weighting construction and design assumptions for{" "}
          {project.title}.
        </p>
      </div>
      {canManage && (
        <div className="mt-8">
          <SamplingDesignForm projectId={id} />
        </div>
      )}
      <section className="mt-8 space-y-4">
        {project.samplingDesigns.map((design) => (
          <article
            key={design.id}
            className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-xs text-cyan-300">
                  {design.type.replaceAll("_", " ")} · v{design.version}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{design.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Created by {design.createdBy.name} · Target{" "}
                  {design.targetSampleSize.toLocaleString()}
                </p>
              </div>
              <span className="text-sm">
                {design.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Population" value={design.populationSize} />
              <Metric label="Sampling frame" value={design.samplingFrameSize} />
              <Metric
                label="Strata variable"
                value={design.strataVariableKey}
              />
              <Metric
                label="Cluster variable"
                value={design.clusterVariableKey}
              />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
              {design.assumptions}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {design.status === ResearchSamplingDesignStatus.DRAFT &&
                canManage && (
                  <SamplingDesignStatusControl
                    id={design.id}
                    target={ResearchSamplingDesignStatus.UNDER_REVIEW}
                    label="Submit for review"
                  />
                )}
              {design.status === ResearchSamplingDesignStatus.UNDER_REVIEW &&
                canManage && (
                  <SamplingDesignStatusControl
                    id={design.id}
                    target={ResearchSamplingDesignStatus.DRAFT}
                    label="Return to draft"
                  />
                )}
              {design.status === ResearchSamplingDesignStatus.UNDER_REVIEW &&
                canApprove &&
                design.createdById !== user.id && (
                  <SamplingDesignStatusControl
                    id={design.id}
                    target={ResearchSamplingDesignStatus.APPROVED}
                    label="Approve design"
                  />
                )}
              {design.status === ResearchSamplingDesignStatus.APPROVED &&
                canManage && (
                  <SamplingDesignStatusControl
                    id={design.id}
                    target={ResearchSamplingDesignStatus.ARCHIVED}
                    label="Archive"
                  />
                )}
            </div>
            {design.approvedBy && (
              <p className="mt-3 text-xs text-emerald-300">
                Approved independently by {design.approvedBy.name}
              </p>
            )}
          </article>
        ))}
        {!project.samplingDesigns.length && (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">
            No governed sampling design created.
          </p>
        )}
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-xl bg-slate-950/40 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value ?? "—"}</p>
    </div>
  );
}
