"use client";

import { generateIncidentCorrectiveActionAiDraft } from "@/features/incidents/incident-capa-ai.actions";
import {
  initialIncidentCorrectiveActionAiActionState,
  type IncidentCorrectiveActionAiRecommendation,
  type IncidentCorrectiveActionAiDraft,
} from "@/modules/incident/incident-capa-ai.types";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Clipboard,
  ClipboardCheck,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  useActionState,
  useState,
} from "react";

type IncidentCapaRecommendationEngineProps = {
  incidentId: string;
};

export function IncidentCapaRecommendationEngine({
  incidentId,
}: IncidentCapaRecommendationEngineProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateIncidentCorrectiveActionAiDraft,
    initialIncidentCorrectiveActionAiActionState
  );

  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
            <Sparkles size={22} />
          </div>

          <div>
            <p className="text-sm text-emerald-300">
              AI CAPA Recommendation
              Engine
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Generate corrective and
              preventive action
              recommendations
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              The engine reviews the
              incident, investigation,
              existing actions, and
              document metadata to
              suggest measurable,
              risk-based controls.
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
          name="incidentId"
          value={incidentId}
        />

        <label className="block text-sm text-slate-300">
          Additional CAPA context
          <textarea
            name="reviewerContext"
            rows={4}
            placeholder="Add verified constraints, available resources, planned controls, management decisions, implementation limitations, or actions already under consideration."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
              Generating
              Recommendations
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={18} />
              Regenerate
              Recommendations
            </>
          ) : (
            <>
              <BrainCircuit size={18} />
              Generate CAPA
              Recommendations
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
                Recommendation
                generation failed
              </p>

              <p className="mt-1 text-sm text-red-100/80">
                {state.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {state.status ===
        "SUCCESS" &&
        state.draft && (
          <RecommendationReview
            draft={state.draft}
            generatedAt={
              state.generatedAt
            }
          />
        )}
    </section>
  );
}

function RecommendationReview({
  draft,
  generatedAt,
}: {
  draft:
    IncidentCorrectiveActionAiDraft;
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
              Human approval required
            </p>

            <p className="mt-1 text-sm text-orange-100/80">
              These recommendations are
              preliminary. Confirm the
              causes, feasibility,
              ownership, resources,
              deadlines, and
              effectiveness measures
              before creating a CAPA.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CopySection
          title="Executive Summary"
          copyText={
            draft.executiveSummary
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {draft.executiveSummary}
          </p>
        </CopySection>

        <CopySection
          title="Control Objective"
          copyText={
            draft.incidentControlObjective
          }
        >
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {
              draft.incidentControlObjective
            }
          </p>
        </CopySection>
      </div>

      <section>
        <div className="flex items-center gap-2">
          <ClipboardCheck
            size={19}
            className="text-emerald-300"
          />

          <h3 className="text-lg font-semibold text-white">
            Recommended Actions
          </h3>
        </div>

        <div className="mt-4 space-y-5">
          {draft.recommendations.map(
            (recommendation) => (
              <RecommendationCard
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
        <NumberedList
          title="Immediate Containment"
          items={
            draft.immediateContainmentActions
          }
        />

        <NumberedList
          title="Preventive Action Themes"
          items={
            draft.preventiveActionThemes
          }
        />

        <NumberedList
          title="Missing Information"
          items={
            draft.missingInformation
          }
        />

        <NumberedList
          title="Implementation Sequence"
          items={
            draft.implementationSequence
          }
        />

        <NumberedList
          title="Management Considerations"
          items={
            draft.managementConsiderations
          }
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <CopySection
          title="Confidence Assessment"
          copyText={`${draft.confidenceAssessment.level}: ${draft.confidenceAssessment.rationale}`}
        >
          <p className="text-sm font-semibold text-emerald-300">
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
        >
          <p className="text-sm leading-7 text-slate-300">
            {draft.limitationsNotice}
          </p>
        </CopySection>
      </div>

      <p className="text-right text-xs text-slate-600">
        Recommendations generated{" "}
        {new Date(
          generatedAt
        ).toLocaleString()}
      </p>
    </div>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation:
    IncidentCorrectiveActionAiRecommendation;
}) {
  const completeCopyText = [
    `Title: ${recommendation.title}`,
    "",
    `Description: ${recommendation.description}`,
    "",
    `Rationale: ${recommendation.rationale}`,
    "",
    `Hierarchy level: ${recommendation.hierarchyLevel.replaceAll("_", " ")}`,
    `Priority: ${recommendation.priority}`,
    `Suggested risk: ${recommendation.suggestedRiskLevel}`,
    `Suggested owner role: ${recommendation.suggestedOwnerRole}`,
    `Suggested due period: ${recommendation.suggestedDueDays} days`,
    "",
    `Addresses: ${recommendation.addressesCause}`,
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
    `Potential duplicate: ${recommendation.duplicationAssessment.appearsDuplicative ? "Yes" : "No"}`,
    `Duplication assessment: ${recommendation.duplicationAssessment.explanation}`,
  ].join("\n");

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-300">
            {
              recommendation.recommendationId
            }
          </p>

          <h4 className="mt-2 text-lg font-semibold text-white">
            {recommendation.title}
          </h4>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            {
              recommendation.description
            }
          </p>
        </div>

        <CopyButton
          copyText={completeCopyText}
          label="Copy Action"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge
          label={
            recommendation.priority
          }
        />

        <Badge
          label={recommendation.suggestedRiskLevel}
        />

        <Badge
          label={recommendation.hierarchyLevel.replaceAll(
            "_",
            " "
          )}
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
        <DetailBlock
          label="Rationale"
          value={
            recommendation.rationale
          }
        />

        <DetailBlock
          label="Addresses Cause"
          value={
            recommendation.addressesCause
          }
        />

        <DetailBlock
          label="Suggested Owner"
          value={
            recommendation.suggestedOwnerRole
          }
        />

        <DetailBlock
          label="Verification Method"
          value={
            recommendation.verificationMethod
          }
        />

        <DetailBlock
          label="Evidence Basis"
          value={
            recommendation.evidenceBasis
          }
        />

        <DetailBlock
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
    </div>
  );
}

function NumberedList({
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
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs font-semibold text-emerald-300">
                  {index + 1}
                </span>

                <span>{item}</span>
              </li>
            )
          )}
        </ol>
      ) : (
        <p className="text-sm text-slate-500">
          None identified.
        </p>
      )}
    </div>
  );
}

function CopySection({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Layers3
            size={17}
            className="text-emerald-300"
          />
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

function Badge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
      {label}
    </span>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value}
      </p>
    </div>
  );
}