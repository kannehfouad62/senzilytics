import {
  PermissionKey,
  ResearchSampleUnitStatus,
  ResearchSamplingDesignStatus,
  ResearchSamplingExecutionStatus,
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SamplingDesignForm,
  SamplingDesignStatusControl,
} from "@/features/research/sampling-design-forms";
import { SamplingFrameUpload } from "@/features/research/sampling-frame-upload";
import {
  SamplingExecutionForm,
  SamplingExecutionStatusControl,
} from "@/features/research/sampling-execution-forms";
import {
  ActivateFieldworkControl,
  CloseFieldworkControl,
  ReserveReplacementControl,
  SampleUnitAssignmentForm,
  SampleUnitDispositionForm,
} from "@/features/research/sampling-fieldwork-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { summarizeFieldworkCounts } from "@/modules/research/research-fieldwork";
export const dynamic = "force-dynamic";
const operationalExecutions = new Set<ResearchSamplingExecutionStatus>([
  ResearchSamplingExecutionStatus.ACTIVE,
  ResearchSamplingExecutionStatus.CLOSED,
]);
const assignableUnits = new Set<ResearchSampleUnitStatus>([
  ResearchSampleUnitStatus.SELECTED,
]);
const activeUnits = new Set<ResearchSampleUnitStatus>([
  ResearchSampleUnitStatus.ASSIGNED,
  ResearchSampleUnitStatus.CONTACTED,
  ResearchSampleUnitStatus.PARTIAL,
]);
const replaceableUnits = new Set<ResearchSampleUnitStatus>([
  ResearchSampleUnitStatus.INELIGIBLE,
  ResearchSampleUnitStatus.REFUSED,
  ResearchSampleUnitStatus.WITHDRAWN,
]);
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
    [project, researchers] = await Promise.all([
      prisma.researchProject.findFirst({
        where: { id, organizationId },
        include: {
          samplingDesigns: {
            include: {
              createdBy: { select: { name: true } },
              approvedBy: { select: { name: true } },
            },
            orderBy: { version: "desc" },
          },
          samplingFrames: {
            include: {
              samplingDesign: true,
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          samplingExecutions: {
            include: {
              samplingDesign: true,
              samplingFrame: true,
              generatedBy: { select: { name: true } },
              approvedBy: { select: { name: true } },
              _count: { select: { units: true } },
              units: {
                include: { assignedTo: { select: { name: true } } },
                orderBy: { selectionOrder: "asc" },
                take: 100,
              },
            },
            orderBy: { generatedAt: "desc" },
          },
        },
      }),
      prisma.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  if (!project) notFound();
  const fieldworkGroups = project.samplingExecutions.length
    ? await prisma.researchSampleUnit.groupBy({
        by: ["executionId", "status", "isReserve"],
        where: {
          executionId: {
            in: project.samplingExecutions.map((item) => item.id),
          },
        },
        _count: { _all: true },
      })
    : [];
  const canManage = permissions.includes(
      PermissionKey.MANAGE_RESEARCH_PROJECTS,
    ),
    canApprove = permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS),
    canCollect = permissions.includes(PermissionKey.COLLECT_RESEARCH_DATA);
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
      {canManage &&
        project.samplingDesigns
          .filter(
            (design) => design.status === ResearchSamplingDesignStatus.APPROVED,
          )
          .map((design) => (
            <div key={design.id} className="mt-8">
              <SamplingFrameUpload projectId={id} designId={design.id} />
            </div>
          ))}
      <section className="mt-9">
        <p className="text-sm text-cyan-300">Private source governance</p>
        <h2 className="mt-1 text-2xl font-semibold">Sampling Frame Register</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {project.samplingFrames.map((frame) => (
            <article
              key={frame.id}
              className="rounded-2xl border border-white/10 bg-white/[.04] p-5"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-xs text-cyan-300">
                    {frame.samplingDesign.type.replaceAll("_", " ")} · Frame v
                    {frame.version}
                  </p>
                  <h3 className="mt-1 font-semibold">{frame.name}</h3>
                </div>
                <span className="text-xs text-emerald-300">{frame.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Validated units" value={frame.rowCount} />
                <Metric label="Identifier" value={frame.identifierColumn} />
                <Metric label="Strata" value={frame.strataColumn} />
                <Metric label="Cluster" value={frame.clusterColumn} />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Private source: {frame.sourceFileName} · Created by{" "}
                {frame.createdBy.name}
              </p>
            </article>
          ))}
          {!project.samplingFrames.length && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No validated sampling frames.
            </p>
          )}
        </div>
      </section>
      {canManage && (
        <div className="mt-9">
          <SamplingExecutionForm
            frames={project.samplingFrames
              .filter(
                (frame) =>
                  frame.status === "VALIDATED" &&
                  frame.samplingDesign.status ===
                    ResearchSamplingDesignStatus.APPROVED,
              )
              .map((frame) => ({
                id: frame.id,
                label: `${frame.name} v${frame.version}`,
                target: frame.samplingDesign.targetSampleSize,
              }))}
          />
        </div>
      )}
      <section className="mt-9">
        <p className="text-sm text-violet-300">
          Reproducible selection governance
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          Sampling Execution Register
        </h2>
        <div className="mt-5 space-y-5">
          {project.samplingExecutions.map((execution) => (
            <article
              key={execution.id}
              className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-violet-300">
                    {execution.samplingDesign.type.replaceAll("_", " ")} ·
                    Execution v{execution.version}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    {execution.samplingFrame.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Generated by {execution.generatedBy.name} ·{" "}
                    {execution.generatedAt.toLocaleString()}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-white/5 px-3 py-1 text-xs">
                  {execution.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Metric
                  label="Primary selected"
                  value={execution.selectedSampleSize}
                />
                <Metric
                  label="Reserve selected"
                  value={execution.reserveSampleSize}
                />
                <Metric label="Total register" value={execution._count.units} />
                <Metric label="Seed" value={execution.seed} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={`/api/research/sampling-executions/${execution.id}/certificate`}
                  className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300"
                >
                  Excel selection certificate
                </a>
                {execution.status ===
                  ResearchSamplingExecutionStatus.GENERATED &&
                  canManage && (
                    <SamplingExecutionStatusControl
                      executionId={execution.id}
                      target={ResearchSamplingExecutionStatus.UNDER_REVIEW}
                      label="Submit for review"
                    />
                  )}
                {execution.status ===
                  ResearchSamplingExecutionStatus.UNDER_REVIEW &&
                  canManage && (
                    <SamplingExecutionStatusControl
                      executionId={execution.id}
                      target={ResearchSamplingExecutionStatus.GENERATED}
                      label="Return to generated"
                    />
                  )}
                {execution.status ===
                  ResearchSamplingExecutionStatus.UNDER_REVIEW &&
                  canApprove &&
                  execution.generatedById !== user.id && (
                    <SamplingExecutionStatusControl
                      executionId={execution.id}
                      target={ResearchSamplingExecutionStatus.APPROVED}
                      label="Approve selection"
                    />
                  )}
                {execution.status ===
                  ResearchSamplingExecutionStatus.APPROVED &&
                  canManage && (
                    <>
                      <ActivateFieldworkControl executionId={execution.id} />
                      <SamplingExecutionStatusControl
                        executionId={execution.id}
                        target={ResearchSamplingExecutionStatus.ARCHIVED}
                        label="Archive selection"
                      />
                    </>
                  )}
                {execution.status === ResearchSamplingExecutionStatus.ACTIVE &&
                  canManage && (
                    <CloseFieldworkControl executionId={execution.id} />
                  )}
              </div>
              {execution.approvedBy && (
                <p className="mt-3 text-xs text-emerald-300">
                  Approved independently by {execution.approvedBy.name}
                </p>
              )}
              {operationalExecutions.has(execution.status) &&
                (() => {
                  const summary = summarizeFieldworkCounts(
                    fieldworkGroups
                      .filter((group) => group.executionId === execution.id)
                      .map((group) => ({
                        status: group.status,
                        isReserve: group.isReserve,
                        count: group._count._all,
                      })),
                  );
                  return (
                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <Metric label="Primary units" value={summary.primary} />
                      <Metric
                        label="Assigned"
                        value={`${summary.assignmentRate.toFixed(1)}%`}
                      />
                      <Metric label="Completed" value={summary.completed} />
                      <Metric
                        label="Response rate"
                        value={`${summary.responseRate.toFixed(1)}%`}
                      />
                    </div>
                  );
                })()}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-2">Order</th>
                      <th className="pb-2">Unit reference</th>
                      <th className="pb-2">Stratum</th>
                      <th className="pb-2">Cluster</th>
                      <th className="pb-2">Probability</th>
                      <th className="pb-2">Weight</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2">Status / owner</th>
                      <th className="pb-2">Fieldwork action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.units.map((unit) => (
                      <tr key={unit.id} className="border-t border-white/5">
                        <td className="py-2">{unit.selectionOrder}</td>
                        <td>{unit.unitReference}</td>
                        <td>{unit.stratum ?? "—"}</td>
                        <td>{unit.cluster ?? "—"}</td>
                        <td>
                          {unit.inclusionProbability?.toFixed(5) ??
                            "Not estimable"}
                        </td>
                        <td>{unit.baseWeight?.toFixed(4) ?? "—"}</td>
                        <td>{unit.isReserve ? "Reserve" : "Primary"}</td>
                        <td>
                          <span>{unit.status.replaceAll("_", " ")}</span>
                          <br />
                          <span className="text-slate-500">
                            {unit.assignedTo?.name ?? "Unassigned"}
                            {unit.dueAt
                              ? ` · ${unit.dueAt.toLocaleDateString()}`
                              : ""}
                          </span>
                        </td>
                        <td className="py-2">
                          {execution.status ===
                            ResearchSamplingExecutionStatus.ACTIVE &&
                            canManage &&
                            assignableUnits.has(unit.status) && (
                              <SampleUnitAssignmentForm
                                unitId={unit.id}
                                researchers={researchers}
                              />
                            )}
                          {execution.status ===
                            ResearchSamplingExecutionStatus.ACTIVE &&
                            canCollect &&
                            unit.assignedToId === user.id &&
                            activeUnits.has(unit.status) && (
                              <SampleUnitDispositionForm unitId={unit.id} />
                            )}
                          {execution.status ===
                            ResearchSamplingExecutionStatus.ACTIVE &&
                            canManage &&
                            !unit.isReserve &&
                            replaceableUnits.has(unit.status) && (
                              <ReserveReplacementControl unitId={unit.id} />
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {execution._count.units > execution.units.length && (
                  <p className="mt-3 text-xs text-slate-500">
                    Showing the first {execution.units.length} selections. The
                    certificate contains the complete register.
                  </p>
                )}
              </div>
            </article>
          ))}
          {!project.samplingExecutions.length && (
            <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">
              No sampling execution generated.
            </p>
          )}
        </div>
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
