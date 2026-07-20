import {
    createRiskControl,
    createRiskLink,
    createRiskReview,
    deleteRiskLink,
    updateRisk,
    updateRiskControlStatus,
  } from "@/features/risks/actions";
  import { RiskMatrix } from "@/features/risks/risk-matrix";
  import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
  import {
    getCurrentUserPermissions,
    requirePermission,
  } from "@/lib/permissions";
  import { prisma } from "@/lib/prisma";
  import { hasSubscriptionFeature } from "@/lib/subscription";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import { RiskAiAdvisor } from "@/features/risks/risk-ai-advisor";
  import { findTenantRiskById } from "@/modules/risk/risk.repository";
  import {
    ConfigurableFormModule,
    DocumentEntityType,
    PermissionKey,
    RiskCategory,
    RiskControlEffectiveness,
    RiskControlHierarchy,
    RiskControlType,
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
    RiskLinkedEntityType,
    RiskReviewFrequency,
    RiskStatus,
    Status,
  } from "@prisma/client";
  import {
    ArrowLeft,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    Gauge,
    History,
    Link2,
    Plus,
    ShieldAlert,
    Trash2,
  } from "lucide-react";
  import Link from "next/link";
  import { notFound } from "next/navigation";
  
  export const dynamic = "force-dynamic";
  
  export default async function RiskDetailPage({
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }) {
    await requirePermission(
      PermissionKey.VIEW_RISKS
    );
  
    const { id } = await params;
  
    const { organizationId, user } =
      await getCurrentUserTenant();
  
    const [
      risk,
      sites,
      departments,
      users,
      permissions,
      documentUploadEnabled,
    ] = await Promise.all([
      findTenantRiskById({
        organizationId,
        riskId: id,
      }),
  
      prisma.site.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
  
      prisma.department.findMany({
        where: {
          site: {
            organizationId,
          },
        },
        select: {
          id: true,
          name: true,
          siteId: true,
          site: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          {
            site: {
              name: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
      }),
  
      prisma.user.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          role: true,
          jobTitle: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      getCurrentUserPermissions(),

      hasSubscriptionFeature(
        organizationId,
        "DOCUMENT_UPLOAD"
      ),
    ]);
  
    if (!risk) {
      notFound();
    }
  
    const now = new Date();
  
    const activeControls =
      risk.controls.filter(
        (control) =>
          control.status !==
            Status.COMPLETED &&
          control.status !==
            Status.CLOSED
      );
  
    const overdueControls =
      activeControls.filter(
        (control) =>
          Boolean(
            control.dueDate &&
              control.dueDate < now
          )
      );
  
    const reviewOverdue =
      Boolean(
        risk.nextReviewDate &&
          risk.nextReviewDate < now &&
          risk.status !==
            RiskStatus.CLOSED &&
          risk.status !==
            RiskStatus.ARCHIVED
      );

    const canUploadCustomFiles =
      documentUploadEnabled &&
      permissions.includes(
        PermissionKey.MANAGE_RISKS
      );
  
    return (
      <div>
        <Link
          href="/risks"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to risk register
        </Link>
  
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <ShieldAlert size={16} />
              {risk.reference}
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {risk.title}
            </h1>
  
            <p className="mt-3 max-w-4xl text-slate-400">
              {risk.description}
            </p>
  
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge
                status={risk.status}
              />
  
              <CategoryBadge
                category={risk.category}
              />
  
              {reviewOverdue && (
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                  REVIEW OVERDUE
                </span>
              )}
            </div>
          </div>
  
          <RiskLevelBadge
            label="Residual Risk"
            score={risk.residualScore}
            riskLevel={
              risk.residualRiskLevel
            }
          />
        </div>
  
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <InfoCard
            label="Site"
            value={
              risk.site?.name ||
              "Enterprise-wide"
            }
          />
  
          <InfoCard
            label="Department"
            value={
              risk.department?.name ||
              "Not assigned"
            }
          />
  
          <InfoCard
            label="Owner"
            value={
              risk.owner?.name ||
              "Not assigned"
            }
          />
  
          <InfoCard
            label="Next Review"
            value={formatDate(
              risk.nextReviewDate
            )}
            critical={reviewOverdue}
          />
  
          <InfoCard
            label="Open Controls"
            value={`${activeControls.length}`}
            detail={`${overdueControls.length} overdue`}
            critical={
              overdueControls.length > 0
            }
          />
        </div>
  
        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <RiskAssessmentCard
            label="Initial Risk"
            score={risk.initialScore}
            riskLevel={
              risk.initialRiskLevel
            }
            likelihood={
              risk.initialLikelihood
            }
            impact={risk.initialImpact}
          />
  
          <RiskAssessmentCard
            label="Current Risk"
            score={risk.currentScore}
            riskLevel={
              risk.currentRiskLevel
            }
            likelihood={
              risk.currentLikelihood
            }
            impact={risk.currentImpact}
          />
  
          <RiskAssessmentCard
            label="Residual Risk"
            score={risk.residualScore}
            riskLevel={
              risk.residualRiskLevel
            }
            likelihood={
              risk.residualLikelihood
            }
            impact={
              risk.residualImpact
            }
          />
        </div>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <Gauge size={21} />
            </div>
  
            <div>
              <h2 className="text-xl font-semibold text-white">
                Current Risk Matrix
              </h2>
  
              <p className="mt-1 text-sm text-slate-400">
                The highlighted cell represents
                the current likelihood and impact.
              </p>
            </div>
          </div>
  
          <div className="mt-6">
            <RiskMatrix
              selectedLikelihood={
                risk.currentLikelihood
              }
              selectedImpact={
                risk.currentImpact
              }
            />
          </div>
        </section>

        <EntityCustomFormSubmissions
          organizationId={organizationId}
          userId={user.id}
          module={
            ConfigurableFormModule.RISK
          }
          entityType={
            DocumentEntityType.RISK
          }
          entityId={risk.id}
          canUpload={
            canUploadCustomFiles
          }
          className="mt-8 space-y-6"
        />

        <div className="mt-8">
  <RiskAiAdvisor
    riskId={risk.id}
    riskReference={risk.reference}
  />
</div>
  
        <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_420px]">
          <main className="space-y-7">
            <section className={sectionClass}>
              <SectionHeading
                title="Risk Profile"
                description="Update the risk scope, ownership, status, current exposure, and residual exposure."
                icon={
                  <ShieldAlert size={21} />
                }
              />
  
              <form
                action={updateRisk}
                className="mt-6 space-y-5"
              >
                <input
                  type="hidden"
                  name="riskId"
                  value={risk.id}
                />
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Title"
                    required
                  >
                    <input
                      name="title"
                      required
                      defaultValue={
                        risk.title
                      }
                      className={inputClass}
                    />
                  </Field>
  
                  <Field
                    label="Category"
                    required
                  >
                    <select
                      name="category"
                      required
                      defaultValue={
                        risk.category
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        RiskCategory
                      ).map(
                        (category) => (
                          <option
                            key={category}
                            value={category}
                          >
                            {formatEnum(
                              category
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                </div>
  
                <Field
                  label="Description"
                  required
                >
                  <textarea
                    name="description"
                    required
                    rows={5}
                    defaultValue={
                      risk.description
                    }
                    className={inputClass}
                  />
                </Field>
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Hazard type">
                    <input
                      name="hazardType"
                      defaultValue={
                        risk.hazardType ||
                        ""
                      }
                      className={inputClass}
                    />
                  </Field>
  
                  <Field label="Process or activity">
                    <input
                      name="process"
                      defaultValue={
                        risk.process || ""
                      }
                      className={inputClass}
                    />
                  </Field>
  
                  <Field label="Site">
                    <select
                      name="siteId"
                      defaultValue={
                        risk.siteId || ""
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Enterprise-wide
                      </option>
  
                      {sites.map(
                        (site) => (
                          <option
                            key={site.id}
                            value={site.id}
                          >
                            {site.name}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
  
                  <Field label="Department">
                    <select
                      name="departmentId"
                      defaultValue={
                        risk.departmentId ||
                        ""
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Not assigned
                      </option>
  
                      {departments.map(
                        (department) => (
                          <option
                            key={
                              department.id
                            }
                            value={
                              department.id
                            }
                          >
                            {
                              department.site
                                .name
                            }{" "}
                            —{" "}
                            {
                              department.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </Field>
  
                  <Field label="Risk owner">
                    <select
                      name="ownerId"
                      defaultValue={
                        risk.ownerId || ""
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Not assigned
                      </option>
  
                      {users.map(
                        (user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.name} —{" "}
                            {user.jobTitle ||
                              formatEnum(
                                user.role
                              )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
  
                  <Field
                    label="Status"
                    required
                  >
                    <select
                      name="status"
                      required
                      defaultValue={
                        risk.status
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        RiskStatus
                      ).map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {formatEnum(
                              status
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                </div>
  
                <AssessmentFields
                  title="Current Assessment"
                  likelihoodName="currentLikelihood"
                  impactName="currentImpact"
                  likelihood={
                    risk.currentLikelihood
                  }
                  impact={
                    risk.currentImpact
                  }
                />
  
                <AssessmentFields
                  title="Residual Assessment"
                  likelihoodName="residualLikelihood"
                  impactName="residualImpact"
                  likelihood={
                    risk.residualLikelihood
                  }
                  impact={
                    risk.residualImpact
                  }
                />
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Review frequency"
                    required
                  >
                    <select
                      name="reviewFrequency"
                      required
                      defaultValue={
                        risk.reviewFrequency
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        RiskReviewFrequency
                      ).map(
                        (frequency) => (
                          <option
                            key={frequency}
                            value={frequency}
                          >
                            {formatEnum(
                              frequency
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
  
                  <Field label="Next review date">
                    <input
                      name="nextReviewDate"
                      type="datetime-local"
                      defaultValue={
                        formatDateInput(
                          risk.nextReviewDate
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
  
                <button
                  type="submit"
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Save Risk Changes
                </button>
              </form>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Risk Controls"
                description="Track existing and planned controls, ownership, implementation, verification, and effectiveness."
                icon={
                  <ClipboardCheck
                    size={21}
                  />
                }
              />
  
              <div className="mt-6 space-y-4">
                {risk.controls.map(
                  (control) => {
                    const overdue =
                      Boolean(
                        control.dueDate &&
                          control.dueDate <
                            now &&
                          control.status !==
                            Status.COMPLETED &&
                          control.status !==
                            Status.CLOSED
                      );
  
                    return (
                      <article
                        key={control.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                                {formatEnum(
                                  control.controlType
                                )}
                              </span>
  
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                {formatEnum(
                                  control.hierarchy
                                )}
                              </span>
  
                              {overdue && (
                                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                                  OVERDUE
                                </span>
                              )}
                            </div>
  
                            <h3 className="mt-3 font-semibold text-white">
                              {control.name}
                            </h3>
  
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {control.description ||
                                "No description provided."}
                            </p>
                          </div>
  
                          <StatusPill
                            status={
                              control.status
                            }
                          />
                        </div>
  
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <InfoBlock
                            label="Owner"
                            value={
                              control.owner
                                ?.name ||
                              "Not assigned"
                            }
                          />
  
                          <InfoBlock
                            label="Effectiveness"
                            value={formatEnum(
                              control.effectiveness
                            )}
                          />
  
                          <InfoBlock
                            label="Due"
                            value={formatDate(
                              control.dueDate
                            )}
                          />
  
                          <InfoBlock
                            label="Verification"
                            value={formatDate(
                              control.verificationDate
                            )}
                          />
                        </div>
  
                        <form
                          action={
                            updateRiskControlStatus
                          }
                          className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-3"
                        >
                          <input
                            type="hidden"
                            name="riskId"
                            value={risk.id}
                          />
  
                          <input
                            type="hidden"
                            name="controlId"
                            value={control.id}
                          />
  
                          <Field label="Status">
                            <select
                              name="status"
                              defaultValue={
                                control.status
                              }
                              className={inputClass}
                            >
                              {Object.values(
                                Status
                              ).map(
                                (status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {formatEnum(
                                      status
                                    )}
                                  </option>
                                )
                              )}
                            </select>
                          </Field>
  
                          <Field label="Effectiveness">
                            <select
                              name="effectiveness"
                              defaultValue={
                                control.effectiveness
                              }
                              className={inputClass}
                            >
                              {Object.values(
                                RiskControlEffectiveness
                              ).map(
                                (
                                  effectiveness
                                ) => (
                                  <option
                                    key={
                                      effectiveness
                                    }
                                    value={
                                      effectiveness
                                    }
                                  >
                                    {formatEnum(
                                      effectiveness
                                    )}
                                  </option>
                                )
                              )}
                            </select>
                          </Field>
  
                          <Field label="Verification result">
                            <input
                              name="verificationResult"
                              defaultValue={
                                control.verificationResult ||
                                ""
                              }
                              className={inputClass}
                            />
                          </Field>
  
                          <div className="md:col-span-3">
                            <button
                              type="submit"
                              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-300 transition hover:bg-cyan-400/20"
                            >
                              Update Control
                            </button>
                          </div>
                        </form>
                      </article>
                    );
                  }
                )}
  
                {risk.controls.length ===
                  0 && (
                  <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
                    No controls have been added.
                  </p>
                )}
              </div>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Risk Review History"
                description="Formal risk reassessments and changes in current exposure over time."
                icon={<History size={21} />}
              />
  
              <div className="mt-6 space-y-4">
                {risk.reviews.map(
                  (review) => (
                    <article
                      key={review.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-cyan-300">
                            {review.reviewDate.toLocaleString(
                              "en-US"
                            )}
                          </p>
  
                          <p className="mt-2 text-sm text-slate-400">
                            Completed by{" "}
                            {review.completedBy
                              ?.name ||
                              "Unknown user"}
                          </p>
                        </div>
  
                        <RiskLevelBadge
                          label="Reviewed Risk"
                          score={review.score}
                          riskLevel={
                            review.riskLevel
                          }
                        />
                      </div>
  
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <InfoBlock
                          label="Likelihood"
                          value={formatEnum(
                            review.likelihood
                          )}
                        />
  
                        <InfoBlock
                          label="Impact"
                          value={formatEnum(
                            review.impact
                          )}
                        />
  
                        <InfoBlock
                          label="Control effectiveness"
                          value={
                            review.controlEffectiveness
                              ? formatEnum(
                                  review.controlEffectiveness
                                )
                              : "Not assessed"
                          }
                        />
  
                        <InfoBlock
                          label="Trend"
                          value={
                            review.trend ||
                            "Not recorded"
                          }
                        />
                      </div>
  
                      {review.notes && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {review.notes}
                        </p>
                      )}
  
                      <p className="mt-3 text-xs text-slate-500">
                        Next review:{" "}
                        {formatDate(
                          review.nextReviewDate
                        )}
                      </p>
                    </article>
                  )
                )}
  
                {risk.reviews.length ===
                  0 && (
                  <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
                    No formal reviews have been completed.
                  </p>
                )}
              </div>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Linked Records"
                description="Connect incidents, CAPAs, audits, inspection findings, compliance obligations, and other records to this risk."
                icon={<Link2 size={21} />}
              />
  
              <div className="mt-6 space-y-3">
                {risk.links.map(
                  (link) => (
                    <div
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                    >
                      <div>
                        <p className="text-xs text-cyan-300">
                          {formatEnum(
                            link.entityType
                          )}
                        </p>
  
                        <p className="mt-1 text-sm font-medium text-white">
                          {link.label ||
                            link.entityId}
                        </p>
  
                        <p className="mt-1 text-xs text-slate-500">
                          Record ID:{" "}
                          {link.entityId}
                        </p>
                      </div>
  
                      <form
                        action={deleteRiskLink}
                      >
                        <input
                          type="hidden"
                          name="riskId"
                          value={risk.id}
                        />
  
                        <input
                          type="hidden"
                          name="linkId"
                          value={link.id}
                        />
  
                        <button
                          type="submit"
                          className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 transition hover:bg-red-400/20"
                          aria-label="Remove linked record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </div>
                  )
                )}
  
                {risk.links.length ===
                  0 && (
                  <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
                    No records are linked to this risk.
                  </p>
                )}
              </div>
            </section>
          </main>
  
          <aside className="space-y-6">
            <form
              action={createRiskControl}
              className={sectionClass}
            >
              <SectionHeading
                title="Add Control"
                description="Record an existing or planned risk treatment."
                icon={<Plus size={20} />}
              />
  
              <input
                type="hidden"
                name="riskId"
                value={risk.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Control name"
                  required
                >
                  <input
                    name="name"
                    required
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Description">
                  <textarea
                    name="description"
                    rows={3}
                    className={inputClass}
                  />
                </Field>
  
                <Field
                  label="Control type"
                  required
                >
                  <select
                    name="controlType"
                    defaultValue={
                      RiskControlType.PLANNED
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskControlType
                    ).map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {formatEnum(type)}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field
                  label="Hierarchy"
                  required
                >
                  <select
                    name="hierarchy"
                    defaultValue={
                      RiskControlHierarchy.ADMINISTRATIVE
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskControlHierarchy
                    ).map(
                      (hierarchy) => (
                        <option
                          key={hierarchy}
                          value={hierarchy}
                        >
                          {formatEnum(
                            hierarchy
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field
                  label="Effectiveness"
                  required
                >
                  <select
                    name="effectiveness"
                    defaultValue={
                      RiskControlEffectiveness.NOT_ASSESSED
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskControlEffectiveness
                    ).map(
                      (
                        effectiveness
                      ) => (
                        <option
                          key={
                            effectiveness
                          }
                          value={
                            effectiveness
                          }
                        >
                          {formatEnum(
                            effectiveness
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field label="Owner">
                  <select
                    name="ownerId"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">
                      Not assigned
                    </option>
  
                    {users.map(
                      (user) => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.name}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field label="Due date">
                  <input
                    name="dueDate"
                    type="datetime-local"
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Verification date">
                  <input
                    name="verificationDate"
                    type="datetime-local"
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Verification method">
                  <input
                    name="verificationMethod"
                    className={inputClass}
                  />
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Add Control
              </button>
            </form>
  
            <form
              action={createRiskReview}
              className={sectionClass}
            >
              <SectionHeading
                title="Complete Review"
                description="Reassess the current risk and record the review outcome."
                icon={
                  <CheckCircle2
                    size={20}
                  />
                }
              />
  
              <input
                type="hidden"
                name="riskId"
                value={risk.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Likelihood"
                  required
                >
                  <select
                    name="likelihood"
                    defaultValue={
                      risk.currentLikelihood
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskLikelihood
                    ).map(
                      (likelihood) => (
                        <option
                          key={
                            likelihood
                          }
                          value={
                            likelihood
                          }
                        >
                          {formatEnum(
                            likelihood
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field
                  label="Impact"
                  required
                >
                  <select
                    name="impact"
                    defaultValue={
                      risk.currentImpact
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskImpact
                    ).map(
                      (impact) => (
                        <option
                          key={impact}
                          value={impact}
                        >
                          {formatEnum(
                            impact
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field label="Control effectiveness">
                  <select
                    name="controlEffectiveness"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">
                      Not assessed
                    </option>
  
                    {Object.values(
                      RiskControlEffectiveness
                    ).map(
                      (
                        effectiveness
                      ) => (
                        <option
                          key={
                            effectiveness
                          }
                          value={
                            effectiveness
                          }
                        >
                          {formatEnum(
                            effectiveness
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field label="Trend">
                  <select
                    name="trend"
                    defaultValue="STABLE"
                    className={inputClass}
                  >
                    <option value="DECREASING">
                      Decreasing
                    </option>
                    <option value="STABLE">
                      Stable
                    </option>
                    <option value="INCREASING">
                      Increasing
                    </option>
                  </select>
                </Field>
  
                <Field label="Next review date">
                  <input
                    name="nextReviewDate"
                    type="datetime-local"
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Review notes">
                  <textarea
                    name="notes"
                    rows={4}
                    className={inputClass}
                  />
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Complete Review
              </button>
            </form>
  
            <form
              action={createRiskLink}
              className={sectionClass}
            >
              <SectionHeading
                title="Link Record"
                description="Associate an existing EHS record using its ID."
                icon={<ExternalLink size={20} />}
              />
  
              <input
                type="hidden"
                name="riskId"
                value={risk.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Record type"
                  required
                >
                  <select
                    name="entityType"
                    defaultValue={
                      RiskLinkedEntityType.INCIDENT
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      RiskLinkedEntityType
                    ).map(
                      (entityType) => (
                        <option
                          key={
                            entityType
                          }
                          value={
                            entityType
                          }
                        >
                          {formatEnum(
                            entityType
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
  
                <Field
                  label="Record ID"
                  required
                >
                  <input
                    name="entityId"
                    required
                    placeholder="Paste the record ID"
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Display label">
                  <input
                    name="label"
                    placeholder="Example: Forklift incident"
                    className={inputClass}
                  />
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                Link Record
              </button>
            </form>
          </aside>
        </div>
      </div>
    );
  }
  
  function AssessmentFields({
    title,
    likelihoodName,
    impactName,
    likelihood,
    impact,
  }: {
    title: string;
    likelihoodName: string;
    impactName: string;
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <h3 className="font-semibold text-white">
          {title}
        </h3>
  
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field
            label="Likelihood"
            required
          >
            <select
              name={likelihoodName}
              required
              defaultValue={likelihood}
              className={inputClass}
            >
              {Object.values(
                RiskLikelihood
              ).map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatEnum(value)}
                  </option>
                )
              )}
            </select>
          </Field>
  
          <Field
            label="Impact"
            required
          >
            <select
              name={impactName}
              required
              defaultValue={impact}
              className={inputClass}
            >
              {Object.values(
                RiskImpact
              ).map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatEnum(value)}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>
      </div>
    );
  }
  
  function SectionHeading({
    title,
    description,
    icon,
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
  }) {
    return (
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
          {icon}
        </div>
  
        <div>
          <h2 className="text-xl font-semibold text-white">
            {title}
          </h2>
  
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </div>
    );
  }
  
  function Field({
    label,
    required = false,
    children,
  }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <label className="block text-sm text-slate-300">
        {label}
  
        {required && (
          <span className="ml-1 text-red-300">
            *
          </span>
        )}
  
        {children}
      </label>
    );
  }
  
  function InfoCard({
    label,
    value,
    detail,
    critical = false,
  }: {
    label: string;
    value: string;
    detail?: string;
    critical?: boolean;
  }) {
    return (
      <div
        className={`rounded-2xl border p-4 ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-white/5"
        }`}
      >
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-2 text-sm font-semibold text-white">
          {value}
        </p>
  
        {detail && (
          <p className="mt-1 text-xs text-slate-500">
            {detail}
          </p>
        )}
      </div>
    );
  }
  
  function InfoBlock({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-1 text-sm text-slate-200">
          {value}
        </p>
      </div>
    );
  }
  
  function RiskAssessmentCard({
    label,
    score,
    riskLevel,
    likelihood,
    impact,
  }: {
    label: string;
    score: number;
    riskLevel: RiskLevel;
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }) {
    return (
      <div
        className={`rounded-3xl border p-6 ${getRiskClassName(
          riskLevel
        )}`}
      >
        <p className="text-sm font-medium opacity-80">
          {label}
        </p>
  
        <p className="mt-3 text-4xl font-bold">
          {score}
        </p>
  
        <p className="mt-1 font-semibold">
          {riskLevel}
        </p>
  
        <div className="mt-4 border-t border-current/10 pt-4 text-xs leading-6 opacity-80">
          <p>
            Likelihood:{" "}
            {formatEnum(likelihood)}
          </p>
  
          <p>
            Impact: {formatEnum(impact)}
          </p>
        </div>
      </div>
    );
  }
  
  function RiskLevelBadge({
    label,
    score,
    riskLevel,
  }: {
    label: string;
    score: number;
    riskLevel: RiskLevel;
  }) {
    return (
      <div
        className={`min-w-36 rounded-2xl border p-4 text-center ${getRiskClassName(
          riskLevel
        )}`}
      >
        <p className="text-xs opacity-80">
          {label}
        </p>
  
        <p className="mt-2 text-3xl font-bold">
          {score}
        </p>
  
        <p className="mt-1 text-xs font-semibold">
          {riskLevel}
        </p>
      </div>
    );
  }
  
  function StatusBadge({
    status,
  }: {
    status: RiskStatus;
  }) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
        {formatEnum(status)}
      </span>
    );
  }
  
  function CategoryBadge({
    category,
  }: {
    category: RiskCategory;
  }) {
    return (
      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
        {formatEnum(category)}
      </span>
    );
  }
  
  function StatusPill({
    status,
  }: {
    status: Status;
  }) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
        {formatEnum(status)}
      </span>
    );
  }
  
  function getRiskClassName(
    riskLevel: RiskLevel
  ) {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return "border-purple-400/20 bg-purple-400/10 text-purple-200";
  
      case RiskLevel.HIGH:
        return "border-red-400/20 bg-red-400/10 text-red-200";
  
      case RiskLevel.MEDIUM:
        return "border-orange-400/20 bg-orange-400/10 text-orange-200";
  
      case RiskLevel.LOW:
      default:
        return "border-green-400/20 bg-green-400/10 text-green-200";
    }
  }
  
  function formatEnum(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }
  
  function formatDate(
    value: Date | null
  ) {
    if (!value) {
      return "Not scheduled";
    }
  
    return value.toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }
  
  function formatDateInput(
    value: Date | null
  ) {
    if (!value) {
      return "";
    }
  
    const offset =
      value.getTimezoneOffset();
  
    return new Date(
      value.getTime() -
        offset * 60 * 1000
    )
      .toISOString()
      .slice(0, 16);
  }
  
  const sectionClass =
    "rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl";
  
  const inputClass =
    "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50";
