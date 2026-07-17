"use client";

import { generateMocExecutiveAiSummary } from "@/features/moc/moc-executive-ai.actions";
import {
  initialMocExecutiveAiActionState,
  type MocExecutiveAiDraft,
  type MocExecutiveAiInsight,
  type MocExecutiveAiPriority,
  type MocExecutiveAiSignificance,
} from "@/modules/moc/moc-executive-ai.types";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  Gauge,
  Lightbulb,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import {
  useActionState,
  useState,
} from "react";

export function MocExecutiveAiSummary() {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateMocExecutiveAiSummary,
    initialMocExecutiveAiActionState
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
              Executive MOC Portfolio Summary
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Generate a management-ready analysis of approval
              bottlenecks, overdue work, temporary-change exposure,
              residual risk, site concentration, workload, governance
              signals, and recommended priorities.
            </p>
          </div>
        </div>

        {state.status ===
          "SUCCESS" && (
          <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
            Summary generated
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
              Management review required
            </p>

            <p className="mt-1 text-sm leading-6 text-orange-100/80">
              The AI analysis is advisory. Validate the observations
              against source records, operational context, and current
              management priorities before using them for decisions.
            </p>
          </div>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-5"
      >
        <label className="block text-sm text-slate-300">
          Executive context or specific concerns

          <textarea
            name="reviewerContext"
            rows={4}
            placeholder="Optional: Identify leadership concerns, strategic priorities, operational constraints, sites requiring attention, or specific trends the AI should examine."
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

              Analyzing Portfolio...
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={17} />
              Regenerate Summary
            </>
          ) : (
            <>
              <Sparkles size={17} />
              Generate Executive Summary
            </>
          )}
        </button>
      </form>

      {state.status ===
        "ERROR" &&
        state.error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <div>
              <p className="font-medium text-red-200">
                Summary could not be generated
              </p>

              <p className="mt-1 text-sm leading-6 text-red-100/80">
                {state.error}
              </p>
            </div>
          </div>
        )}

      {state.status ===
        "SUCCESS" && (
          <ExecutiveSummaryReview
            draft={state.draft}
            generatedAt={
              state.generatedAt
            }
          />
        )}
    </section>
  );
}

function ExecutiveSummaryReview({
  draft,
  generatedAt,
}: {
  draft: MocExecutiveAiDraft;
  generatedAt: string;
}) {
  return (
    <div className="mt-7 space-y-6 border-t border-white/10 pt-6">
      <CopySection
        title="Executive Summary"
        copyText={
          draft.executiveSummary
        }
        icon={
          <BrainCircuit size={19} />
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.executiveSummary}
        </p>
      </CopySection>

      <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-slate-400">
              Overall Portfolio Condition
            </p>

            <div className="mt-3">
              <PortfolioConditionBadge
                condition={
                  draft.portfolioAssessment
                    .overallCondition
                }
              />
            </div>
          </div>

          <Gauge
            size={30}
            className="text-purple-300"
          />
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-300">
          {
            draft.portfolioAssessment
              .rationale
          }
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <InsightSection
          title="Key Findings"
          insights={
            draft.keyFindings
          }
          icon={
            <Lightbulb size={19} />
          }
        />

        <InsightSection
          title="Positive Signals"
          insights={
            draft.positiveSignals
          }
          icon={
            <TrendingUp size={19} />
          }
        />

        <InsightSection
          title="Approval Bottlenecks"
          insights={
            draft.approvalBottlenecks
          }
          icon={
            <Users size={19} />
          }
        />

        <InsightSection
          title="Implementation Risks"
          insights={
            draft.implementationRisks
          }
          icon={
            <Workflow size={19} />
          }
        />

        <InsightSection
          title="Temporary Change Exposure"
          insights={
            draft.temporaryChangeExposure
          }
          icon={
            <TimerReset size={19} />
          }
        />

        <InsightSection
          title="Site Exposure Insights"
          insights={
            draft.siteExposureInsights
          }
          icon={
            <MapPinned size={19} />
          }
        />

        <InsightSection
          title="Owner Workload Insights"
          insights={
            draft.ownerWorkloadInsights
          }
          icon={
            <Clock3 size={19} />
          }
        />

        <InsightSection
          title="Risk Profile Insights"
          insights={
            draft.riskProfileInsights
          }
          icon={
            <ShieldAlert size={19} />
          }
        />

        <InsightSection
          title="Governance Insights"
          insights={
            draft.governanceInsights
          }
          icon={
            <ClipboardCheck
              size={19}
            />
          }
        />
      </div>

      <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
        <div className="flex items-center gap-2">
          <Target
            size={19}
            className="text-purple-300"
          />

          <h3 className="font-semibold text-white">
            Recommended Management Priorities
          </h3>
        </div>

        <div className="mt-5 space-y-4">
          {draft.recommendedPriorities.map(
            (priority) => (
              <PriorityCard
                key={`${priority.priority}-${priority.title}`}
                priority={priority}
              />
            )
          )}

          {draft.recommendedPriorities
            .length === 0 && (
            <EmptyState message="No management priorities were generated." />
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <StringListSection
          title="Management Questions"
          items={
            draft.managementQuestions
          }
          icon={
            <CircleHelp size={19} />
          }
        />

        <StringListSection
          title="Data Quality Cautions"
          items={
            draft.dataQualityCautions
          }
          icon={
            <AlertTriangle
              size={19}
            />
          }
          warning
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CopySection
          title="Confidence Assessment"
          copyText={`${draft.confidenceAssessment.level}: ${draft.confidenceAssessment.rationale}`}
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
        </CopySection>

        <CopySection
          title="Limitations"
          copyText={
            draft.limitationsNotice
          }
          icon={
            <AlertTriangle
              size={19}
            />
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {draft.limitationsNotice}
          </p>
        </CopySection>
      </div>

      <p className="text-right text-xs text-slate-600">
        Executive summary generated{" "}
        {new Date(
          generatedAt
        ).toLocaleString()}
      </p>
    </div>
  );
}

function InsightSection({
  title,
  insights,
  icon,
}: {
  title: string;
  insights: MocExecutiveAiInsight[];
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex items-center gap-2">
        <span className="text-purple-300">
          {icon}
        </span>

        <h3 className="font-semibold text-white">
          {title}
        </h3>
      </div>

      <div className="mt-4 space-y-4">
        {insights.map(
          (insight, index) => (
            <article
              key={`${insight.title}-${index}`}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="font-semibold text-white">
                  {insight.title}
                </h4>

                <SignificanceBadge
                  significance={
                    insight.significance
                  }
                />
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {insight.observation}
              </p>

              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-xs text-slate-500">
                  Evidence Basis
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {insight.evidenceBasis}
                </p>
              </div>
            </article>
          )
        )}

        {insights.length === 0 && (
          <EmptyState message="No material insights were identified for this category." />
        )}
      </div>
    </section>
  );
}

function PriorityCard({
  priority,
}: {
  priority: MocExecutiveAiPriority;
}) {
  return (
    <article className="rounded-2xl border border-purple-400/20 bg-slate-950/50 p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-400/10 text-sm font-bold text-purple-300">
          {priority.priority}
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-white">
            {priority.title}
          </h4>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            {
              priority.recommendedAction
            }
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Detail
          label="Rationale"
          value={priority.rationale}
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
        () => {
          setCopied(false);
        },
        1800
      );
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-300">
            {icon}
          </span>

          <h3 className="font-semibold text-white">
            {title}
          </h3>
        </div>

        <button
          type="button"
          onClick={copyContent}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-purple-400/30 hover:text-white"
        >
          {copied ? (
            <>
              <CheckCircle2
                size={15}
              />
              Copied
            </>
          ) : (
            <>
              <Copy size={15} />
              Copy
            </>
          )}
        </button>
      </div>

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

function StringListSection({
  title,
  items,
  icon,
  warning = false,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
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
      <div className="flex items-center gap-2">
        <span
          className={
            warning
              ? "text-orange-300"
              : "text-purple-300"
          }
        >
          {icon}
        </span>

        <h3 className="font-semibold text-white">
          {title}
        </h3>
      </div>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map(
            (item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex items-start gap-3 text-sm leading-6 text-slate-300"
              >
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                    warning
                      ? "bg-orange-300"
                      : "bg-purple-300"
                  }`}
                />

                {item}
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          None identified.
        </p>
      )}
    </section>
  );
}

function PortfolioConditionBadge({
  condition,
}: {
  condition:
    | "STABLE"
    | "WATCH"
    | "ELEVATED"
    | "CRITICAL";
}) {
  const className =
    condition === "CRITICAL"
      ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
      : condition === "ELEVATED"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : condition === "WATCH"
          ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
          : "border-green-400/20 bg-green-400/10 text-green-300";

  return (
    <span
      className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${className}`}
    >
      {formatEnum(condition)}
    </span>
  );
}

function SignificanceBadge({
  significance,
}: {
  significance: MocExecutiveAiSignificance;
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
      {formatEnum(significance)}
    </span>
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