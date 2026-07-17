"use client";

import {
  applyMocAiRecommendations,
  generateMocAiAssessment,
} from "@/features/moc/moc-ai.actions";
import {
  initialMocAiActionState,
  initialMocAiApplyActionState,
  type MocAiAssessmentDraft,
} from "@/modules/moc/moc-ai.types";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
} from "react";

type MocAiAssistantProps = {
  mocId: string;
};

export function MocAiAssistant({
  mocId,
}: MocAiAssistantProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateMocAiAssessment,
    initialMocAiActionState
  );

  return (
    <section className="rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-300">
            <BrainCircuit size={22} />
          </div>

          <div>
            <p className="text-sm text-purple-300">
              Senzilytics AI
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              AI Change Assessment
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Generate a review-only assessment of hazards,
              controls, residual risk, required approvals,
              implementation tasks, verification activities,
              information gaps, and management priorities.
            </p>
          </div>
        </div>

        {state.status ===
          "SUCCESS" && (
          <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
            Assessment generated
          </span>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert
            size={18}
            className="mt-0.5 shrink-0 text-orange-300"
          />

          <div>
            <p className="font-medium text-orange-200">
              Qualified review required
            </p>

            <p className="mt-1 text-sm leading-6 text-orange-100/80">
              AI recommendations are advisory. Validate all
              hazards, controls, risk ratings, approvals, tasks,
              and regulatory considerations before applying them.
            </p>
          </div>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-5"
      >
        <input
          type="hidden"
          name="mocId"
          value={mocId}
        />

        <label className="block text-sm text-slate-300">
          Reviewer context or specific concerns

          <textarea
            name="reviewerContext"
            rows={4}
            placeholder="Optional: Identify concerns, known constraints, operational conditions, contractor involvement, startup requirements, or areas the AI should examine closely."
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
              Assessing Change...
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={17} />
              Regenerate Assessment
            </>
          ) : (
            <>
              <Sparkles size={17} />
              Generate AI Assessment
            </>
          )}
        </button>
      </form>

      {state.status ===
        "ERROR" && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-red-300"
          />

          <div>
            <p className="font-medium text-red-200">
              Assessment could not be generated
            </p>

            <p className="mt-1 text-sm leading-6 text-red-100/80">
              {state.error}
            </p>
          </div>
        </div>
      )}

      {state.status ===
        "SUCCESS" && (
        <MocAiAssessmentReview
          mocId={mocId}
          draft={state.draft}
          generatedAt={
            state.generatedAt
          }
        />
      )}
    </section>
  );
}



function MocAiAssessmentReview({
  mocId,
  draft,
  generatedAt,
}: {
  mocId: string;
  draft: MocAiAssessmentDraft;
  generatedAt: string;
}) {
  return (
    <div className="mt-7 space-y-6 border-t border-white/10 pt-6">
      <ReviewSection
        title="Executive Summary"
        icon={
          <BrainCircuit size={19} />
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.executiveSummary}
        </p>
      </ReviewSection>

      <section className="grid gap-4 md:grid-cols-3">
        <AssessmentCard
          label="Scope Clarity"
          value={
            draft
              .changeConditionAssessment
              .scopeClarity
          }
        />

        <AssessmentCard
          label="Impact Clarity"
          value={
            draft
              .changeConditionAssessment
              .impactClarity
          }
        />

        <AssessmentCard
          label="Implementation Readiness"
          value={
            draft
              .changeConditionAssessment
              .implementationReadiness
          }
        />
      </section>

      <ReviewSection
        title="Change Condition Assessment"
        icon={
          <ClipboardCheck
            size={19}
          />
        }
      >
        <p className="text-sm leading-7 text-slate-300">
          {
            draft
              .changeConditionAssessment
              .rationale
          }
        </p>
      </ReviewSection>

      <ReviewSection
        title="Major Hazards"
        icon={
          <ShieldAlert size={19} />
        }
      >
        <div className="space-y-4">
          {draft.majorHazards.map(
            (hazard, index) => (
              <article
                key={`${hazard.title}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
                    {formatEnum(
                      hazard.category
                    )}
                  </span>

                  <SignificanceBadge
                    significance={
                      hazard.significance
                    }
                  />
                </div>

                <h4 className="mt-3 font-semibold text-white">
                  {hazard.title}
                </h4>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {hazard.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Detail
                    label="Exposure Pathway"
                    value={
                      hazard.exposurePathway
                    }
                  />

                  <Detail
                    label="Potential Consequence"
                    value={
                      hazard.potentialConsequence
                    }
                  />

                  <Detail
                    label="Evidence Basis"
                    value={
                      hazard.evidenceBasis
                    }
                  />
                </div>
              </article>
            )
          )}

          {draft.majorHazards.length ===
            0 && (
            <EmptyState message="No material hazards were identified from the supplied information." />
          )}
        </div>
      </ReviewSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <StringListSection
          title="Operational Risks"
          items={
            draft.operationalRisks
          }
        />

        <StringListSection
          title="Safety Risks"
          items={draft.safetyRisks}
        />

        <StringListSection
          title="Environmental Risks"
          items={
            draft.environmentalRisks
          }
        />

        <StringListSection
          title="Quality Risks"
          items={draft.qualityRisks}
        />

        <StringListSection
          title="Regulatory Considerations"
          items={
            draft.regulatoryConsiderations
          }
        />

        <StringListSection
          title="Human-Factor Considerations"
          items={
            draft.humanFactorConsiderations
          }
        />
      </div>

      <ReviewSection
        title="Recommended Controls"
        icon={<Target size={19} />}
      >
        <div className="space-y-4">
          {draft.recommendedControls.map(
            (control) => (
              <article
                key={
                  control.recommendationId
                }
                className="rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {
                      control.recommendationId
                    }
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {formatEnum(
                      control.hierarchy
                    )}
                  </span>

                  <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
                    {formatEnum(
                      control.priority
                    )}
                  </span>

                  {control
                    .duplicationAssessment
                    .appearsDuplicative && (
                    <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs text-yellow-300">
                      POSSIBLE DUPLICATE
                    </span>
                  )}
                </div>

                <h4 className="mt-3 font-semibold text-white">
                  {control.title}
                </h4>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {control.description}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Detail
                    label="Rationale"
                    value={
                      control.rationale
                    }
                  />

                  <Detail
                    label="Suggested Owner"
                    value={
                      control.suggestedOwnerFunction
                    }
                  />

                  <Detail
                    label="Verification Method"
                    value={
                      control.verificationMethod
                    }
                  />

                  <Detail
                    label="Evidence Basis"
                    value={
                      control.evidenceBasis
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <CompactList
                    label="Addresses Hazards"
                    items={
                      control.addressesHazards
                    }
                  />

                  <CompactList
                    label="Effectiveness Criteria"
                    items={
                      control.effectivenessCriteria
                    }
                  />
                </div>

                {control
                  .duplicationAssessment
                  .appearsDuplicative && (
                  <p className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm leading-6 text-yellow-100/80">
                    {
                      control
                        .duplicationAssessment
                        .explanation
                    }
                  </p>
                )}
              </article>
            )
          )}

          {draft.recommendedControls
            .length === 0 && (
            <EmptyState message="No additional control recommendations were generated." />
          )}
        </div>
      </ReviewSection>

      <ReviewSection
        title="Recommended Residual Risk"
        icon={<Gauge size={19} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AssessmentCard
            label="Likelihood"
            value={
              draft
                .residualRiskRecommendation
                .likelihood
            }
          />

          <AssessmentCard
            label="Impact"
            value={
              draft
                .residualRiskRecommendation
                .impact
            }
          />

          <AssessmentCard
            label="Score"
            value={String(
              draft
                .residualRiskRecommendation
                .score
            )}
          />

          <AssessmentCard
            label="Risk Level"
            value={
              draft
                .residualRiskRecommendation
                .riskLevel
            }
          />
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-300">
          {
            draft
              .residualRiskRecommendation
              .rationale
          }
        </p>

        <div className="mt-4">
          <CompactList
            label="Assessment Assumptions"
            items={
              draft
                .residualRiskRecommendation
                .assumptions
            }
          />
        </div>
      </ReviewSection>

      <MocAiApplyRecommendations
        mocId={mocId}
        draft={draft}
      />

      



      <div className="grid gap-6 xl:grid-cols-2">
        <ReviewSection
          title="Recommended Approvals"
          icon={<Users size={19} />}
        >
          <div className="space-y-3">
            {draft.recommendedApprovals.map(
              (approval, index) => (
                <article
                  key={`${approval.role}-${index}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
                      Sequence{" "}
                      {approval.sequence}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        approval.required
                          ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
                          : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                      }`}
                    >
                      {approval.required
                        ? "REQUIRED"
                        : "OPTIONAL"}
                    </span>
                  </div>

                  <h4 className="mt-3 font-semibold text-white">
                    {formatEnum(
                      approval.role
                    )}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {approval.rationale}
                  </p>
                </article>
              )
            )}

            {draft.recommendedApprovals
              .length === 0 && (
              <EmptyState message="No additional approval roles were recommended." />
            )}
          </div>
        </ReviewSection>

        <ReviewSection
          title="Recommended Tasks"
          icon={
            <ListChecks size={19} />
          }
        >
          <div className="space-y-3">
            {draft.recommendedTasks.map(
              (task) => (
                <article
                  key={
                    task.recommendationId
                  }
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                      {
                        task.recommendationId
                      }
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {formatEnum(
                        task.taskType
                      )}
                    </span>

                    {task.required && (
                      <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
                        REQUIRED
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 font-semibold text-white">
                    {task.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {task.description}
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Detail
                      label="Suggested Owner"
                      value={
                        task.suggestedOwnerFunction
                      }
                    />

                    <Detail
                      label="Suggested Due Period"
                      value={`${task.suggestedDueDays} day(s)`}
                    />

                    <Detail
                      label="Completion Evidence"
                      value={
                        task.completionEvidence
                      }
                    />

                    <CompactList
                      label="Verification Criteria"
                      items={
                        task.verificationCriteria
                      }
                    />
                  </div>
                </article>
              )
            )}

            {draft.recommendedTasks
              .length === 0 && (
              <EmptyState message="No implementation tasks were recommended." />
            )}
          </div>
        </ReviewSection>
      </div>

      <ReviewSection
        title="Verification Activities"
        icon={
          <FileCheck2 size={19} />
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {draft.verificationActivities.map(
            (activity, index) => (
              <article
                key={`${activity.title}-${index}`}
                className="rounded-2xl border border-green-400/20 bg-slate-950/50 p-5"
              >
                <h4 className="font-semibold text-white">
                  {activity.title}
                </h4>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {activity.description}
                </p>

                <div className="mt-4 space-y-3">
                  <Detail
                    label="Suggested Owner"
                    value={
                      activity.suggestedOwnerFunction
                    }
                  />

                  <Detail
                    label="Timing"
                    value={
                      activity.timing
                    }
                  />

                  <Detail
                    label="Evidence Required"
                    value={
                      activity.evidenceRequired
                    }
                  />

                  <CompactList
                    label="Acceptance Criteria"
                    items={
                      activity.acceptanceCriteria
                    }
                  />
                </div>
              </article>
            )
          )}

          {draft.verificationActivities
            .length === 0 && (
            <div className="xl:col-span-2">
              <EmptyState message="No verification activities were recommended." />
            </div>
          )}
        </div>
      </ReviewSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <StringListSection
          title="Documentation Updates"
          items={
            draft.documentationUpdates
          }
        />

        <StringListSection
          title="Training Needs"
          items={draft.trainingNeeds}
        />

        <StringListSection
          title="Inspection Needs"
          items={draft.inspectionNeeds}
        />

        <StringListSection
          title="Communication Needs"
          items={
            draft.communicationNeeds
          }
        />

        <StringListSection
          title="Information Gaps"
          items={draft.informationGaps}
          warning
        />

        <StringListSection
          title="Review Questions"
          items={draft.reviewQuestions}
          warning
        />

        <StringListSection
          title="Escalation Considerations"
          items={
            draft.escalationConsiderations
          }
          warning
        />
      </div>

      <ReviewSection
        title="Management Priorities"
        icon={<Lightbulb size={19} />}
      >
        <div className="space-y-4">
          {draft.managementPriorities.map(
            (priority) => (
              <article
                key={`${priority.priority}-${priority.title}`}
                className="rounded-2xl border border-purple-400/20 bg-slate-950/50 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-400/10 text-sm font-semibold text-purple-300">
                    {priority.priority}
                  </span>

                  <h4 className="font-semibold text-white">
                    {priority.title}
                  </h4>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {
                    priority.recommendedAction
                  }
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Detail
                    label="Rationale"
                    value={
                      priority.rationale
                    }
                  />

                  <Detail
                    label="Suggested Owner"
                    value={
                      priority.suggestedOwnerFunction
                    }
                  />

                  <Detail
                    label="Suggested Timeframe"
                    value={
                      priority.suggestedTimeframe
                    }
                  />

                  <Detail
                    label="Success Measure"
                    value={
                      priority.successMeasure
                    }
                  />
                </div>
              </article>
            )
          )}
        </div>
      </ReviewSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReviewSection
          title="Confidence Assessment"
          icon={
            <CheckCircle2
              size={19}
            />
          }
        >
          <p className="font-semibold text-purple-300">
            {
              draft.confidenceAssessment
                .level
            }
          </p>

          <p className="mt-2 text-sm leading-7 text-slate-300">
            {
              draft.confidenceAssessment
                .rationale
            }
          </p>
        </ReviewSection>

        <ReviewSection
          title="Limitations"
          icon={
            <AlertTriangle
              size={19}
            />
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {draft.limitationsNotice}
          </p>
        </ReviewSection>
      </div>

      <p className="text-right text-xs text-slate-600">
        Assessment generated{" "}
        {new Date(
          generatedAt
        ).toLocaleString()}
      </p>
    </div>
  );
}


function MocAiApplyRecommendations({
  mocId,
  draft,
}: {
  mocId: string;
  draft: MocAiAssessmentDraft;
}) {
  const router = useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    applyMocAiRecommendations,
    initialMocAiApplyActionState
  );

  useEffect(() => {
    if (
      state.status ===
      "SUCCESS"
    ) {
      router.refresh();
    }
  }, [
    state.status,
    router,
  ]);

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
          <CheckCircle2 size={19} />
        </div>

        <div>
          <h3 className="font-semibold text-white">
            Apply Reviewed Recommendations
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Select which recommendations should be applied to this
            change. Existing approval roles and matching tasks are
            preserved and skipped.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-400/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-orange-300"
          />

          <p className="text-sm leading-6 text-orange-100/80">
            Review every recommendation before applying it. New
            approval requirements remain pending, new tasks remain
            not started, and the AI does not approve, advance, or
            close the change.
          </p>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-5"
      >
        <input
          type="hidden"
          name="mocId"
          value={mocId}
        />

        <input
          type="hidden"
          name="residualLikelihood"
          value={
            draft
              .residualRiskRecommendation
              .likelihood
          }
        />

        <input
          type="hidden"
          name="residualImpact"
          value={
            draft
              .residualRiskRecommendation
              .impact
          }
        />

        <input
          type="hidden"
          name="residualRiskRationale"
          value={
            draft
              .residualRiskRecommendation
              .rationale
          }
        />

        <input
          type="hidden"
          name="recommendedApprovals"
          value={JSON.stringify(
            draft.recommendedApprovals
          )}
        />

        <input
          type="hidden"
          name="recommendedTasks"
          value={JSON.stringify(
            draft.recommendedTasks
          )}
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <ApplyOption
            name="applyResidualRisk"
            title="Residual Risk"
            description={`${formatEnum(
              draft
                .residualRiskRecommendation
                .likelihood
            )} likelihood · ${formatEnum(
              draft
                .residualRiskRecommendation
                .impact
            )} impact · Score ${
              draft
                .residualRiskRecommendation
                .score
            }`}
            defaultChecked
          />

          <ApplyOption
            name="applyApprovals"
            title="Approval Requirements"
            description={`${draft.recommendedApprovals.filter(
              (approval) =>
                approval.required
            ).length} required approval recommendation(s)`}
            defaultChecked={
              draft.recommendedApprovals.some(
                (approval) =>
                  approval.required
              )
            }
          />

          <ApplyOption
            name="applyTasks"
            title="Implementation Tasks"
            description={`${draft.recommendedTasks.length} task recommendation(s)`}
            defaultChecked={
              draft.recommendedTasks.length >
              0
            }
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle
                size={17}
                className="animate-spin"
              />

              Applying Recommendations...
            </>
          ) : (
            <>
              <CheckCircle2 size={17} />
              Apply Selected Recommendations
            </>
          )}
        </button>
      </form>

      {state.status ===
        "ERROR" &&
        state.message && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <div>
              <p className="font-medium text-red-200">
                Recommendations could not be applied
              </p>

              <p className="mt-1 text-sm leading-6 text-red-100/80">
                {state.message}
              </p>
            </div>
          </div>
        )}

      {state.status ===
        "SUCCESS" &&
        state.message && (
          <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-green-300"
              />

              <div>
                <p className="font-medium text-green-200">
                  Recommendations applied
                </p>

                <p className="mt-1 text-sm text-green-100/80">
                  {state.message}
                </p>
              </div>
            </div>

            {state.result && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <ResultMetric
                  label="Residual risk"
                  value={
                    state.result
                      .residualRiskUpdated
                      ? "Updated"
                      : "Not changed"
                  }
                />

                <ResultMetric
                  label="Approvals created"
                  value={String(
                    state.result
                      .approvalsCreated
                  )}
                />

                <ResultMetric
                  label="Approvals skipped"
                  value={String(
                    state.result
                      .approvalsSkipped
                  )}
                />

                <ResultMetric
                  label="Tasks created"
                  value={String(
                    state.result
                      .tasksCreated
                  )}
                />

                <ResultMetric
                  label="Tasks skipped"
                  value={String(
                    state.result
                      .tasksSkipped
                  )}
                />
              </div>
            )}
          </div>
        )}
    </section>
  );
}

function ApplyOption({
  name,
  title,
  description,
  defaultChecked = false,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-cyan-400/30">
      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        className="mt-1 h-4 w-4 shrink-0"
      />

      <span>
        <span className="block text-sm font-semibold text-white">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-green-400/20 bg-slate-950/40 p-3">
      <p className="text-xs text-green-100/60">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-green-100">
        {value}
      </p>
    </div>
  );
}

function ReviewSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-purple-300">
          {icon}
        </span>

        <h3 className="font-semibold text-white">
          {title}
        </h3>
      </div>

      {children}
    </section>
  );
}

function StringListSection({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${
        warning
          ? "border-orange-400/20 bg-orange-400/5"
          : "border-white/10 bg-slate-950/40"
      }`}
    >
      <h3 className="font-semibold text-white">
        {title}
      </h3>

      <div className="mt-4">
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map(
              (item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-start gap-3 text-sm leading-6 text-slate-300"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-300" />
                  {item}
                </li>
              )
            )}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            None identified.
          </p>
        )}
      </div>
    </section>
  );
}

function AssessmentCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-white">
        {formatEnum(value)}
      </p>
    </div>
  );
}

function Detail({
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

      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function CompactList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map(
            (item, index) => (
              <li
                key={`${item}-${index}`}
                className="text-sm leading-6 text-slate-300"
              >
                • {item}
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          None
        </p>
      )}
    </div>
  );
}

function SignificanceBadge({
  significance,
}: {
  significance:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
}) {
  const className =
    significance === "CRITICAL"
      ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
      : significance === "HIGH"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : significance === "MEDIUM"
          ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
          : "border-green-400/20 bg-green-400/10 text-green-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {significance}
    </span>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
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

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-400/50";
