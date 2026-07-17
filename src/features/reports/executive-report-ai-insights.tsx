"use client";

import { generateExecutiveReportAiDraft } from "@/features/reports/executive-report-ai.actions";
import {
  initialExecutiveReportAiActionState,
  type ExecutiveReportAiDraft,
  type ExecutiveReportAiInsight,
  type ExecutiveReportAiPriority,
} from "@/modules/report/executive-report-ai.types";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
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

type ExecutiveReportAiInsightsProps = {
  from: string;
  to: string;
  siteId?: string | null;
  siteName?: string | null;
};

export function ExecutiveReportAiInsights({
  from,
  to,
  siteId,
  siteName,
}: ExecutiveReportAiInsightsProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateExecutiveReportAiDraft,
    initialExecutiveReportAiActionState
  );

  return (
    <section className="mt-8 rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 shadow-2xl backdrop-blur-xl print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-300">
            <BrainCircuit size={23} />
          </div>

          <div>
            <p className="text-sm text-purple-300">
              AI Executive Insights
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Generate a management briefing
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Analyze the selected reporting period for material
              risk signals, positive performance, CAPA concerns,
              site exposure, governance issues, and management
              priorities.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Scope:{" "}
              {siteName || "All sites"} ·{" "}
              {from} through {to}
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
          name="from"
          value={from}
        />

        <input
          type="hidden"
          name="to"
          value={to}
        />

        <input
          type="hidden"
          name="siteId"
          value={siteId || ""}
        />

        <label className="block text-sm text-slate-300">
          Leadership context
          <textarea
            name="leadershipContext"
            rows={4}
            placeholder="Add management priorities, business changes, known reporting limitations, operational constraints, or topics leadership wants emphasized."
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
              Generating Insights
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={18} />
              Regenerate Insights
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Generate AI Insights
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
                Insight generation failed
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
          <ExecutiveInsightsReview
            draft={state.draft}
            generatedAt={
              state.generatedAt
            }
          />
        )}
    </section>
  );
}

function ExecutiveInsightsReview({
  draft,
  generatedAt,
}: {
  draft: ExecutiveReportAiDraft;
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
              Management review required
            </p>

            <p className="mt-1 text-sm leading-6 text-orange-100/80">
              This analysis is advisory. Validate the observations
              against source records and operational context before
              using them in leadership decisions.
            </p>
          </div>
        </div>
      </div>

      <CopySection
        title="Executive Summary"
        copyText={draft.executiveSummary}
        icon={
          <BrainCircuit size={18} />
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.executiveSummary}
        </p>
      </CopySection>

      <div className="grid gap-5 xl:grid-cols-2">
        <InsightSection
          title="Key Findings"
          insights={draft.keyFindings}
          icon={
            <Lightbulb size={18} />
          }
        />

        <InsightSection
          title="Positive Signals"
          insights={draft.positiveSignals}
          icon={
            <TrendingUp size={18} />
          }
        />

        <InsightSection
          title="Risk Signals"
          insights={draft.riskSignals}
          icon={
            <ShieldAlert size={18} />
          }
        />

        <InsightSection
          title="CAPA Insights"
          insights={draft.capaInsights}
          icon={
            <Target size={18} />
          }
        />

        <InsightSection
          title="Audit and Inspection Insights"
          insights={
            draft.auditAndInspectionInsights
          }
          icon={
            <Lightbulb size={18} />
          }
        />

        <InsightSection
          title="Site Exposure Insights"
          insights={
            draft.siteExposureInsights
          }
          icon={
            <ShieldAlert size={18} />
          }
        />

        <InsightSection
          title="Governance Insights"
          insights={
            draft.governanceInsights
          }
          icon={
            <BrainCircuit size={18} />
          }
        />
      </div>

      <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
            <BrainCircuit size={19} />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Cross-Module Intelligence
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              Relationships identified across incidents, CAPAs,
              audits, inspections, compliance, training, and the
              enterprise risk register.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {draft.crossModuleInsights.map(
            (insight, index) => (
              <CrossModuleInsightCard
                key={`${insight.title}-${index}`}
                insight={insight}
              />
            )
          )}

          {draft.crossModuleInsights.length === 0 && (
            <EmptyInsightState message="No material cross-module relationships were identified." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-purple-400/10 p-2 text-purple-300">
            <ShieldAlert size={19} />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Enterprise Risk Insights
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              Executive observations based on current and residual
              exposure, control effectiveness, review performance,
              ownership, and site risk concentration.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {draft.enterpriseRiskInsights.map(
            (insight, index) => (
              <EnterpriseRiskInsightCard
                key={`${insight.title}-${index}`}
                insight={insight}
              />
            )
          )}

          {draft.enterpriseRiskInsights.length === 0 && (
            <EmptyInsightState message="No material enterprise-risk insights were generated." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-green-400/20 bg-green-400/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-green-400/10 p-2 text-green-300">
            <TrendingUp size={19} />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Strategic Opportunities
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              Improvement opportunities that may strengthen
              prevention, governance, risk reduction, and management
              visibility.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {draft.strategicOpportunities.map(
            (opportunity, index) => (
              <StrategicOpportunityCard
                key={`${opportunity.title}-${index}`}
                opportunity={opportunity}
              />
            )
          )}

          {draft.strategicOpportunities.length === 0 && (
            <div className="xl:col-span-2">
              <EmptyInsightState message="No strategic opportunities were generated." />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-orange-400/20 bg-orange-400/5 p-5">
  <div className="flex items-start gap-3">
    <div className="rounded-xl bg-orange-400/10 p-2 text-orange-300">
      <TrendingUp size={19} />
    </div>

    <div>
      <h3 className="font-semibold text-white">
        Predictive Signals
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Evidence-based signals that may indicate emerging
        exposure, deteriorating controls, recurring issues,
        overdue pressure, or performance divergence.
      </p>
    </div>
  </div>

  <div className="mt-5 space-y-4">
    {draft.predictiveSignals.map(
      (signal, index) => (
        <PredictiveSignalCard
          key={`${signal.title}-${index}`}
          signal={signal}
        />
      )
    )}

    {draft.predictiveSignals.length === 0 && (
      <EmptyInsightState message="No material predictive signals were identified." />
    )}
  </div>
</section>

<section className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
  <div className="flex items-start gap-3">
    <div className="rounded-xl bg-blue-400/10 p-2 text-blue-300">
      <Gauge size={19} />
    </div>

    <div>
      <h3 className="font-semibold text-white">
        Effectiveness Insights
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Review-only assessments of CAPA, audits, inspections,
        training, risk controls, and governance performance.
      </p>
    </div>
  </div>

  <div className="mt-5 grid gap-4 xl:grid-cols-2">
    {draft.effectivenessInsights.map(
      (insight, index) => (
        <EffectivenessInsightCard
          key={`${insight.area}-${insight.title}-${index}`}
          insight={insight}
        />
      )
    )}

    {draft.effectivenessInsights.length === 0 && (
      <div className="xl:col-span-2">
        <EmptyInsightState message="There was insufficient evidence to generate effectiveness insights." />
      </div>
    )}
  </div>
</section>

<section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
  <div className="flex items-start gap-3">
    <div className="rounded-xl bg-purple-400/10 p-2 text-purple-300">
      <CalendarClock size={19} />
    </div>

    <div>
      <h3 className="font-semibold text-white">
        Forecast Considerations
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Forward-looking management considerations based on
        current conditions, observed exposure, and available
        evidence—not guaranteed predictions.
      </p>
    </div>
  </div>

  <div className="mt-5 space-y-4">
    {draft.forecastConsiderations.map(
      (forecast, index) => (
        <ForecastConsiderationCard
          key={`${forecast.title}-${index}`}
          forecast={forecast}
        />
      )
    )}

    {draft.forecastConsiderations.length === 0 && (
      <EmptyInsightState message="No supportable forecast considerations were generated." />
    )}
  </div>
</section>

<section className="rounded-2xl border border-green-400/20 bg-green-400/5 p-5">
  <div className="flex items-start gap-3">
    <div className="rounded-xl bg-green-400/10 p-2 text-green-300">
      <Activity size={19} />
    </div>

    <div>
      <h3 className="font-semibold text-white">
        Leading Indicator Recommendations
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Suggested measurable indicators that leadership can
        monitor for early signs of deteriorating performance
        or increasing exposure.
      </p>
    </div>
  </div>

  <div className="mt-5 grid gap-4 xl:grid-cols-2">
    {draft.leadingIndicatorRecommendations.map(
      (indicator, index) => (
        <LeadingIndicatorCard
          key={`${indicator.indicator}-${index}`}
          indicator={indicator}
        />
      )
    )}

    {draft.leadingIndicatorRecommendations.length === 0 && (
      <div className="xl:col-span-2">
        <EmptyInsightState message="No leading-indicator recommendations were generated." />
      </div>
    )}
  </div>
</section>

      

      <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <div className="flex items-center gap-2">
          <Target
            size={18}
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

          {draft.recommendedPriorities.length === 0 && (
            <EmptyInsightState message="No management priorities were generated." />
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <CopySection
          title="Data Quality Cautions"
          copyText={draft.dataQualityCautions
            .map(
              (item, index) =>
                `${index + 1}. ${item}`
            )
            .join("\n")}
          icon={
            <AlertTriangle size={18} />
          }
        >
          <NumberedList
            items={
              draft.dataQualityCautions
            }
          />
        </CopySection>

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
      </div>

      <CopySection
        title="Limitations"
        copyText={draft.limitationsNotice}
        icon={
          <ShieldAlert size={18} />
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.limitationsNotice}
        </p>
      </CopySection>

      <p className="text-right text-xs text-slate-600">
        Insights generated{" "}
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
  insights: ExecutiveReportAiInsight[];
  icon: React.ReactNode;
}) {
  const copyText = insights
    .map(
      (insight, index) =>
        `${index + 1}. ${insight.title}\n` +
        `Observation: ${insight.observation}\n` +
        `Evidence: ${insight.evidenceBasis}\n` +
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
          No material observations were generated.
        </p>
      )}
    </CopySection>
  );
}

function InsightCard({
  insight,
}: {
  insight: ExecutiveReportAiInsight;
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

function PriorityCard({
  priority,
}: {
  priority: ExecutiveReportAiPriority;
}) {
  const copyText = [
    `Priority ${priority.priority}: ${priority.title}`,
    "",
    `Recommended action: ${priority.recommendedAction}`,
    "",
    `Rationale: ${priority.rationale}`,
    "",
    `Suggested owner: ${priority.suggestedOwnerFunction}`,
    `Suggested timeframe: ${priority.suggestedTimeframe}`,
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
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {priority.recommendedAction}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

function CrossModuleInsightCard({
  insight,
}: {
  insight: {
    title: string;
    observation: string;
    supportingEvidence: string;
    significance:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
  };
}) {
  const copyText = [
    insight.title,
    "",
    `Observation: ${insight.observation}`,
    "",
    `Supporting evidence: ${insight.supportingEvidence}`,
    "",
    `Significance: ${insight.significance}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
              CROSS-MODULE
            </span>

            <SignificanceBadge
              significance={
                insight.significance
              }
            />
          </div>

          <h4 className="mt-3 font-semibold text-white">
            {insight.title}
          </h4>
        </div>

        <CopyButton
          copyText={copyText}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {insight.observation}
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Supporting Evidence
        </p>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {insight.supportingEvidence}
        </p>
      </div>
    </article>
  );
}

function EnterpriseRiskInsightCard({
  insight,
}: {
  insight: {
    title: string;
    observation: string;
    supportingEvidence: string;
    recommendedExecutiveAction: string;
  };
}) {
  const copyText = [
    insight.title,
    "",
    `Observation: ${insight.observation}`,
    "",
    `Supporting evidence: ${insight.supportingEvidence}`,
    "",
    `Recommended executive action: ${insight.recommendedExecutiveAction}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-purple-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
            ENTERPRISE RISK
          </span>

          <h4 className="mt-3 font-semibold text-white">
            {insight.title}
          </h4>
        </div>

        <CopyButton
          copyText={copyText}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {insight.observation}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Detail
          label="Supporting Evidence"
          value={
            insight.supportingEvidence
          }
        />

        <Detail
          label="Recommended Executive Action"
          value={
            insight.recommendedExecutiveAction
          }
        />
      </div>
    </article>
  );
}

function StrategicOpportunityCard({
  opportunity,
}: {
  opportunity: {
    title: string;
    opportunity: string;
    expectedBenefit: string;
    recommendedOwnerFunction: string;
  };
}) {
  const copyText = [
    opportunity.title,
    "",
    `Opportunity: ${opportunity.opportunity}`,
    "",
    `Expected benefit: ${opportunity.expectedBenefit}`,
    "",
    `Recommended owner: ${opportunity.recommendedOwnerFunction}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-green-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
            OPPORTUNITY
          </span>

          <h4 className="mt-3 font-semibold text-white">
            {opportunity.title}
          </h4>
        </div>

        <CopyButton
          copyText={copyText}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {opportunity.opportunity}
      </p>

      <div className="mt-4 space-y-3">
        <Detail
          label="Expected Benefit"
          value={
            opportunity.expectedBenefit
          }
        />

        <Detail
          label="Recommended Owner"
          value={
            opportunity.recommendedOwnerFunction
          }
        />
      </div>
    </article>
  );
}

function EmptyInsightState({
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

function PredictiveSignalCard({
  signal,
}: {
  signal: ExecutiveReportAiDraft["predictiveSignals"][number];
}) {
  const copyText = [
    signal.title,
    "",
    `Signal type: ${formatLabel(signal.signalType)}`,
    `Direction: ${formatLabel(signal.direction)}`,
    `Horizon: ${formatLabel(signal.horizon)}`,
    `Significance: ${signal.significance}`,
    "",
    `Observation: ${signal.observation}`,
    "",
    `Supporting evidence: ${signal.supportingEvidence}`,
    "",
    `Management consideration: ${signal.managementConsideration}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-orange-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
              {formatLabel(signal.signalType)}
            </span>

            <DirectionBadge
              direction={signal.direction}
            />

            <SignificanceBadge
              significance={signal.significance}
            />
          </div>

          <h4 className="mt-3 font-semibold text-white">
            {signal.title}
          </h4>
        </div>

        <CopyButton copyText={copyText} />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {signal.observation}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Detail
          label="Supporting Evidence"
          value={signal.supportingEvidence}
        />

        <Detail
          label="Management Consideration"
          value={signal.managementConsideration}
        />

        <div className="space-y-3">
          <Detail
            label="Forecast Horizon"
            value={formatLabel(signal.horizon)}
          />

          <Detail
            label="Direction"
            value={formatLabel(signal.direction)}
          />
        </div>
      </div>
    </article>
  );
}

function EffectivenessInsightCard({
  insight,
}: {
  insight: ExecutiveReportAiDraft["effectivenessInsights"][number];
}) {
  const copyText = [
    insight.title,
    "",
    `Area: ${formatLabel(insight.area)}`,
    `Assessment: ${formatLabel(insight.assessment)}`,
    "",
    `Observation: ${insight.observation}`,
    "",
    `Supporting evidence: ${insight.supportingEvidence}`,
    "",
    `Evidence limitations: ${insight.evidenceLimitations}`,
    "",
    `Recommended review action: ${insight.recommendedReviewAction}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-blue-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
              {formatLabel(insight.area)}
            </span>

            <EffectivenessBadge
              assessment={insight.assessment}
            />
          </div>

          <h4 className="mt-3 font-semibold text-white">
            {insight.title}
          </h4>
        </div>

        <CopyButton copyText={copyText} />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {insight.observation}
      </p>

      <div className="mt-4 space-y-3">
        <Detail
          label="Supporting Evidence"
          value={insight.supportingEvidence}
        />

        <Detail
          label="Evidence Limitations"
          value={insight.evidenceLimitations}
        />

        <Detail
          label="Recommended Review Action"
          value={insight.recommendedReviewAction}
        />
      </div>
    </article>
  );
}

function ForecastConsiderationCard({
  forecast,
}: {
  forecast: ExecutiveReportAiDraft["forecastConsiderations"][number];
}) {
  const copyText = [
    forecast.title,
    "",
    `Forecast horizon: ${forecast.forecastHorizon}`,
    "",
    `Current conditions: ${forecast.currentConditions}`,
    "",
    `Potential development: ${forecast.potentialDevelopment}`,
    "",
    `Supporting evidence: ${forecast.supportingEvidence}`,
    "",
    `Uncertainty: ${forecast.uncertainty}`,
    "",
    `Suggested preparation: ${forecast.suggestedPreparation}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-purple-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300">
            {forecast.forecastHorizon}
          </span>

          <h4 className="mt-3 font-semibold text-white">
            {forecast.title}
          </h4>
        </div>

        <CopyButton copyText={copyText} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Detail
          label="Current Conditions"
          value={forecast.currentConditions}
        />

        <Detail
          label="Potential Development"
          value={forecast.potentialDevelopment}
        />

        <Detail
          label="Supporting Evidence"
          value={forecast.supportingEvidence}
        />

        <Detail
          label="Uncertainty"
          value={forecast.uncertainty}
        />
      </div>

      <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-purple-300">
          Suggested Preparation
        </p>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {forecast.suggestedPreparation}
        </p>
      </div>
    </article>
  );
}

function LeadingIndicatorCard({
  indicator,
}: {
  indicator: ExecutiveReportAiDraft["leadingIndicatorRecommendations"][number];
}) {
  const copyText = [
    indicator.indicator,
    "",
    `Purpose: ${indicator.purpose}`,
    "",
    `Source module: ${indicator.sourceModule}`,
    `Review frequency: ${indicator.suggestedReviewFrequency}`,
    `Escalation threshold: ${indicator.escalationThreshold}`,
  ].join("\n");

  return (
    <article className="rounded-2xl border border-green-400/20 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
            {indicator.sourceModule}
          </span>

          <h4 className="mt-3 font-semibold text-white">
            {indicator.indicator}
          </h4>
        </div>

        <CopyButton copyText={copyText} />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300">
        {indicator.purpose}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Detail
          label="Suggested Review Frequency"
          value={indicator.suggestedReviewFrequency}
        />

        <Detail
          label="Escalation Threshold"
          value={indicator.escalationThreshold}
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
        />
      </div>

      {children}
    </section>
  );
}

function CopyButton({
  copyText,
}: {
  copyText: string;
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
          Copy
        </>
      )}
    </button>
  );
}

function NumberedList({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No cautions were identified.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map(
        (item, index) => (
          <li
            key={`${index}-${item}`}
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

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {value}
      </p>
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

function DirectionBadge({
  direction,
}: {
  direction:
    ExecutiveReportAiDraft["predictiveSignals"][number]["direction"];
}) {
  const className =
    direction === "DETERIORATING"
      ? "border-red-400/20 bg-red-400/10 text-red-300"
      : direction === "IMPROVING"
        ? "border-green-400/20 bg-green-400/10 text-green-300"
        : direction === "STABLE"
          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {formatLabel(direction)}
    </span>
  );
}

function EffectivenessBadge({
  assessment,
}: {
  assessment:
    ExecutiveReportAiDraft["effectivenessInsights"][number]["assessment"];
}) {
  const className =
    assessment === "INEFFECTIVE"
      ? "border-red-400/20 bg-red-400/10 text-red-300"
      : assessment === "PARTIALLY_EFFECTIVE"
        ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
        : assessment === "EFFECTIVE"
          ? "border-green-400/20 bg-green-400/10 text-green-300"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {formatLabel(assessment)}
    </span>
  );
}

function formatLabel(
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