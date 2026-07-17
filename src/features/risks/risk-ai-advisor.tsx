"use client";

import { generateRiskAiDraft } from "@/features/risks/risk-ai.actions";
import {
  initialRiskAiActionState,
  type RiskAiControlRecommendation,
  type RiskAiDraft,
  type RiskAiInsight,
  type RiskAiManagementPriority,
  type RiskAiSignificance,
} from "@/modules/risk/risk-ai.types";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Clipboard,
  Gauge,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useActionState,
  useState,
} from "react";

type RiskAiAdvisorProps = {
  riskId: string;
  riskReference: string;
};

export function RiskAiAdvisor({
  riskId,
  riskReference,
}: RiskAiAdvisorProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateRiskAiDraft,
    initialRiskAiActionState
  );

  return (
    <section className="rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-300">
            <BrainCircuit size={23} />
          </div>

          <div>
            <p className="text-sm text-purple-300">
              AI Risk Advisor
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Analyze {riskReference}
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review exposure, control gaps,
              governance, monitoring indicators,
              evidence needs, and preliminary
              treatment recommendations.
            </p>
          </div>
        </div>

        <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
          REVIEW ONLY
        </span>
      </div>

      <form
        action={formAction}
        className="mt-6"
      >
        <input
          type="hidden"
          name="riskId"
          value={riskId}
        />

        <label className="block text-sm text-slate-300">
          Additional advisor context

          <textarea
            name="advisorContext"
            rows={4}
            placeholder="Add verified operating constraints, recent changes, exposure information, planned treatments, leadership concerns, or known data limitations."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-400"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
              Generating Analysis
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={18} />
              Regenerate Analysis
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Generate AI Risk Analysis
            </>
          )}
        </button>
      </form>

      {state.status === "ERROR" && (
        <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <div>
              <p className="font-medium text-red-200">
                Risk analysis failed
              </p>

              <p className="mt-1 text-sm text-red-100/80">
                {state.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {state.status === "SUCCESS" &&
        state.draft && (
          <RiskAiReview
            draft={state.draft}
            generatedAt={
              state.generatedAt
            }
          />
        )}
    </section>
  );
}

function RiskAiReview({
  draft,
  generatedAt,
}: {
  draft: RiskAiDraft;
  generatedAt: string;
}) {
  return (
    <div className="mt-7 space-y-6 border-t border-white/10 pt-6">
      <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert
            size={19}
            className="mt-0.5 shrink-0 text-orange-300"
          />

          <div>
            <p className="font-medium text-orange-200">
              Human review required
            </p>

            <p className="mt-1 text-sm leading-6 text-orange-100/80">
              Validate the analysis against
              operating evidence, source records,
              risk-owner knowledge, and qualified
              professional judgment before
              updating the risk or creating controls.
            </p>
          </div>
        </div>
      </div>

      <CopySection
        title="Executive Summary"
        copyText={
          draft.executiveSummary
        }
        icon={
          <BrainCircuit size={18} />
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.executiveSummary}
        </p>
      </CopySection>

      <RiskConditionCard
        draft={draft}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <InsightSection
          title="Key Insights"
          insights={draft.keyInsights}
          icon={<Lightbulb size={18} />}
        />

        <InsightSection
          title="Control Gaps"
          insights={
            draft.controlGapInsights
          }
          icon={<ShieldAlert size={18} />}
        />

        <InsightSection
          title="Ownership and Governance"
          insights={
            draft.ownershipAndGovernanceInsights
          }
          icon={<Target size={18} />}
        />

        <InsightSection
          title="Monitoring Insights"
          insights={
            draft.monitoringInsights
          }
          icon={<Gauge size={18} />}
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert
            size={18}
            className="text-purple-300"
          />

          <h3 className="font-semibold text-white">
            Recommended Controls
          </h3>
        </div>

        <div className="mt-5 space-y-5">
          {draft.recommendedControls.map(
            (recommendation) => (
              <ControlRecommendationCard
                key={
                  recommendation.recommendationId
                }
                recommendation={
                  recommendation
                }
              />
            )
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ListSection
          title="Evidence Gaps"
          items={draft.evidenceGaps}
        />

        <ListSection
          title="Risk Review Questions"
          items={draft.reviewQuestions}
        />

        <ListSection
          title="Suggested Leading Indicators"
          items={
            draft.suggestedLeadingIndicators
          }
        />

        <ListSection
          title="Suggested Lagging Indicators"
          items={
            draft.suggestedLaggingIndicators
          }
        />

        <ListSection
          title="Escalation Considerations"
          items={
            draft.escalationConsiderations
          }
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <div className="flex items-center gap-2">
          <Target
            size={18}
            className="text-purple-300"
          />

          <h3 className="font-semibold text-white">
            Management Priorities
          </h3>
        </div>

        <div className="mt-5 space-y-4">
          {draft.managementPriorities.map(
            (priority) => (
              <ManagementPriorityCard
                key={`${priority.priority}-${priority.title}`}
                priority={priority}
              />
            )
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <CopySection
          title="Confidence Assessment"
          copyText={`${draft.confidenceAssessment.level}: ${draft.confidenceAssessment.rationale}`}
          icon={
            <BrainCircuit size={18} />
          }
        >
          <p className="text-sm font-semibold text-purple-300">
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
        </CopySection>

        <CopySection
          title="Limitations"
          copyText={
            draft.limitationsNotice
          }
          icon={
            <ShieldAlert size={18} />
          }
        >
          <p className="text-sm leading-7 text-slate-300">
            {draft.limitationsNotice}
          </p>
        </CopySection>
      </div>

      <p className="text-right text-xs text-slate-600">
        Analysis generated{" "}
        {new Date(
          generatedAt
        ).toLocaleString()}
      </p>
    </div>
  );
}

function RiskConditionCard({
  draft,
}: {
  draft: RiskAiDraft;
}) {
  const condition =
    draft.riskConditionAssessment;

  const copyText = [
    `Current exposure: ${condition.currentExposure}`,
    "",
    `Residual exposure: ${condition.residualExposure}`,
    "",
    `Risk direction: ${condition.riskDirection}`,
    "",
    `Rationale: ${condition.rationale}`,
  ].join("\n");

  return (
    <CopySection
      title="Risk Condition Assessment"
      copyText={copyText}
      icon={
        condition.riskDirection ===
        "INCREASING" ? (
          <TrendingUp size={18} />
        ) : (
          <TrendingDown size={18} />
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Detail
          label="Current Exposure"
          value={
            condition.currentExposure
          }
        />

        <Detail
          label="Residual Exposure"
          value={
            condition.residualExposure
          }
        />

        <Detail
          label="Risk Direction"
          value={
            condition.riskDirection
          }
        />

        <Detail
          label="Rationale"
          value={condition.rationale}
        />
      </div>
    </CopySection>
  );
}

function InsightSection({
  title,
  insights,
  icon,
}: {
  title: string;
  insights: RiskAiInsight[];
  icon: React.ReactNode;
}) {
  const copyText = insights
    .map(
      (insight, index) =>
        `${index + 1}. ${insight.title}\n` +
        `Observation: ${insight.observation}\n` +
        `Evidence basis: ${insight.evidenceBasis}\n` +
        `Significance: ${insight.significance}`
    )
    .join("\n\n");

  return (
    <CopySection
      title={title}
      copyText={copyText}
      icon={icon}
    >
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map(
            (insight, index) => (
              <InsightCard
                key={`${title}-${index}`}
                insight={insight}
              />
            )
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No material observations generated.
        </p>
      )}
    </CopySection>
  );
}

function InsightCard({
  insight,
}: {
  insight: RiskAiInsight;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-medium text-white">
          {insight.title}
        </h4>

        <SignificanceBadge
          significance={
            insight.significance
          }
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {insight.observation}
      </p>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Evidence basis:{" "}
        {insight.evidenceBasis}
      </p>
    </article>
  );
}

function ControlRecommendationCard({
  recommendation,
}: {
  recommendation:
    RiskAiControlRecommendation;
}) {
  const copyText = [
    `${recommendation.recommendationId}: ${recommendation.title}`,
    "",
    `Description: ${recommendation.description}`,
    "",
    `Rationale: ${recommendation.rationale}`,
    "",
    `Control hierarchy: ${recommendation.controlHierarchy}`,
    `Priority: ${recommendation.priority}`,
    `Suggested owner: ${recommendation.suggestedOwnerFunction}`,
    `Suggested due period: ${recommendation.suggestedDueDays} days`,
    "",
    `Addresses exposure: ${recommendation.addressesExposure}`,
    "",
    "Implementation steps:",
    ...recommendation.implementationSteps.map(
      (step, index) =>
        `${index + 1}. ${step}`
    ),
    "",
    "Dependencies:",
    ...recommendation.dependencies.map(
      (dependency, index) =>
        `${index + 1}. ${dependency}`
    ),
    "",
    `Verification method: ${recommendation.verificationMethod}`,
    "",
    "Effectiveness criteria:",
    ...recommendation.effectivenessCriteria.map(
      (criterion, index) =>
        `${index + 1}. ${criterion}`
    ),
    "",
    `Evidence basis: ${recommendation.evidenceBasis}`,
    "",
    `Potential duplicate: ${
      recommendation
        .duplicationAssessment
        .appearsDuplicative
        ? "Yes"
        : "No"
    }`,
    `Duplication assessment: ${recommendation.duplicationAssessment.explanation}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-purple-300">
            {
              recommendation.recommendationId
            }
          </p>

          <h4 className="mt-2 font-semibold text-white">
            {recommendation.title}
          </h4>
        </div>

        <CopyButton
          copyText={copyText}
          label="Copy Control"
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {recommendation.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge
          label={
            recommendation.priority
          }
        />

        <Badge
          label={
            recommendation.controlHierarchy.replaceAll(
              "_",
              " "
            )
          }
        />

        <Badge
          label={`${recommendation.suggestedDueDays} DAYS`}
        />
      </div>

      {recommendation
        .duplicationAssessment
        .appearsDuplicative && (
        <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
          <p className="text-xs font-semibold text-orange-300">
            POSSIBLE DUPLICATE
          </p>

          <p className="mt-2 text-sm text-orange-100/80">
            {
              recommendation
                .duplicationAssessment
                .explanation
            }
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Detail
          label="Rationale"
          value={
            recommendation.rationale
          }
        />

        <Detail
          label="Suggested Owner"
          value={
            recommendation.suggestedOwnerFunction
          }
        />

        <Detail
          label="Addresses Exposure"
          value={
            recommendation.addressesExposure
          }
        />

        <Detail
          label="Verification Method"
          value={
            recommendation.verificationMethod
          }
        />

        <Detail
          label="Evidence Basis"
          value={
            recommendation.evidenceBasis
          }
        />

        <Detail
          label="Duplication Assessment"
          value={
            recommendation
              .duplicationAssessment
              .explanation
          }
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <SmallList
          title="Implementation Steps"
          items={
            recommendation.implementationSteps
          }
        />

        <SmallList
          title="Dependencies"
          items={
            recommendation.dependencies
          }
        />

        <SmallList
          title="Effectiveness Criteria"
          items={
            recommendation.effectivenessCriteria
          }
        />
      </div>
    </article>
  );
}

function ManagementPriorityCard({
  priority,
}: {
  priority: RiskAiManagementPriority;
}) {
  const copyText = [
    `Priority ${priority.priority}: ${priority.title}`,
    "",
    `Recommended action: ${priority.recommendedAction}`,
    "",
    `Rationale: ${priority.rationale}`,
    "",
    `Suggested owner: ${priority.suggestedOwnerFunction}`,
    `Timeframe: ${priority.suggestedTimeframe}`,
    `Success measure: ${priority.successMeasure}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-purple-300">
            PRIORITY{" "}
            {priority.priority}
          </p>

          <h4 className="mt-2 font-semibold text-white">
            {priority.title}
          </h4>
        </div>

        <CopyButton
          copyText={copyText}
          label="Copy"
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {priority.recommendedAction}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Detail
          label="Rationale"
          value={priority.rationale}
        />

        <Detail
          label="Owner"
          value={
            priority.suggestedOwnerFunction
          }
        />

        <Detail
          label="Timeframe"
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
  );
}

function ListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <CopySection
      title={title}
      copyText={items
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")}
      icon={<Lightbulb size={18} />}
    >
      <SmallList
        title=""
        items={items}
      />
    </CopySection>
  );
}

function SmallList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      {title && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
      )}

      {items.length > 0 ? (
        <ol className="space-y-2">
          {items.map(
            (item, index) => (
              <li
                key={`${title}-${index}`}
                className="flex gap-3 text-sm leading-6 text-slate-300"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-400/10 text-xs font-semibold text-purple-300">
                  {index + 1}
                </span>

                <span>{item}</span>
              </li>
            )
          )}
        </ol>
      ) : (
        <p className="text-sm text-slate-500">
          No items generated.
        </p>
      )}
    </div>
  );
}

function CopySection({
  title,
  copyText,
  icon,
  children,
}: {
  title: string;
  copyText: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <span className="text-purple-300">
            {icon}
          </span>

          {title}
        </h3>

        <CopyButton
          copyText={copyText}
          label="Copy"
        />
      </div>

      {children}
    </section>
  );
}

function CopyButton({
  copyText,
  label,
}: {
  copyText: string;
  label: string;
}) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(
        copyText
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1800
      );
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyContent}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
    >
      {copied ? (
        <>
          <Check
            size={14}
            className="text-green-300"
          />
          Copied
        </>
      ) : (
        <>
          <Clipboard size={14} />
          {label}
        </>
      )}
    </button>
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
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function Badge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
      {label}
    </span>
  );
}

function SignificanceBadge({
  significance,
}: {
  significance: RiskAiSignificance;
}) {
  const className =
    significance ===
    "CRITICAL"
      ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
      : significance ===
          "HIGH"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : significance ===
            "MEDIUM"
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