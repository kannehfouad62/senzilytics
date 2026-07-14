"use client";

import { generateIncidentInvestigationAiDraft } from "@/features/incidents/incident-ai.actions";
import {
  initialIncidentInvestigationAiActionState,
  type IncidentInvestigationAiDraft,
} from "@/modules/incident/incident-ai.types";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import {
  useActionState,
  useState,
} from "react";

type IncidentInvestigationAssistantProps = {
  incidentId: string;
};

export function IncidentInvestigationAssistant({
  incidentId,
}: IncidentInvestigationAssistantProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateIncidentInvestigationAiDraft,
    initialIncidentInvestigationAiActionState
  );

  return (
    <section className="rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-300">
            <BrainCircuit size={22} />
          </div>

          <div>
            <p className="text-sm text-purple-300">
              AI Investigation Assistant
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Generate a preliminary investigation draft
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              The assistant analyzes the incident information,
              existing investigation fields, corrective actions,
              and document metadata. It does not read attachment
              contents and does not save anything automatically.
            </p>
          </div>
        </div>

        <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
          HUMAN REVIEW REQUIRED
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
          Additional investigator context
          <textarea
            name="investigatorContext"
            rows={4}
            placeholder="Add known facts, witness information, equipment details, environmental conditions, or questions the assistant should consider. Do not include information you are not authorized to process."
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
              Generating Draft
            </>
          ) : state.status ===
            "SUCCESS" ? (
            <>
              <RefreshCw size={18} />
              Regenerate Draft
            </>
          ) : (
            <>
              <BrainCircuit size={18} />
              Generate AI Draft
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
                Draft generation failed
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
          <InvestigationDraftReview
            draft={state.draft}
            generatedAt={
              state.generatedAt
            }
          />
        )}
    </section>
  );
}

function InvestigationDraftReview({
  draft,
  generatedAt,
}: {
  draft: IncidentInvestigationAiDraft;
  generatedAt: string;
}) {
  return (
    <div className="mt-7 space-y-5 border-t border-white/10 pt-6">
      <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert
            size={19}
            className="mt-0.5 shrink-0 text-orange-300"
          />

          <div>
            <p className="font-medium text-orange-200">
              Preliminary, unverified analysis
            </p>

            <p className="mt-1 text-sm text-orange-100/80">
              Review every statement against evidence, interviews,
              procedures, records, and qualified professional
              judgment before using it in the investigation.
            </p>
          </div>
        </div>
      </div>

      <DraftSection
        title="Investigation Summary"
        copyText={
          draft.investigationSummary
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {draft.investigationSummary}
        </p>
      </DraftSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DraftList
          title="Immediate-Cause Hypotheses"
          items={
            draft.immediateCauseHypotheses
          }
        />

        <DraftList
          title="Root-Cause Hypotheses"
          items={
            draft.rootCauseHypotheses
          }
        />

        <DraftList
          title="Contributing Factors"
          items={
            draft.contributingFactors
          }
        />

        <DraftList
          title="Evidence to Collect"
          items={
            draft.evidenceToCollect
          }
        />
      </div>

      <DraftSection
        title="Five-Whys Analysis"
        copyText={draft.fiveWhys
          .map(
            (item) =>
              `${item.level}. ${item.question}\nAnswer: ${item.answer}\nEvidence basis: ${item.evidenceBasis}`
          )
          .join("\n\n")}
      >
        <div className="space-y-3">
          {draft.fiveWhys.map(
            (item) => (
              <div
                key={item.level}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
              >
                <p className="text-xs font-semibold text-purple-300">
                  WHY {item.level}
                </p>

                <p className="mt-2 font-medium text-white">
                  {item.question}
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {item.answer}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Evidence basis:{" "}
                  {item.evidenceBasis}
                </p>
              </div>
            )
          )}
        </div>
      </DraftSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DraftList
          title="Interview Questions"
          items={
            draft.interviewQuestions
          }
        />

        <DraftList
          title="Data Gaps and Uncertainties"
          items={draft.dataGaps}
        />

        <DraftList
          title="Recommended Next Steps"
          items={
            draft.recommendedNextSteps
          }
        />

        <DraftList
          title="Preliminary Corrective-Action Themes"
          items={
            draft.preliminaryCorrectiveActionThemes
          }
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <DraftSection
          title="Confidence Assessment"
          copyText={`${draft.confidenceAssessment.level}: ${draft.confidenceAssessment.rationale}`}
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
        </DraftSection>

        <DraftSection
          title="Limitations"
          copyText={
            draft.limitationsNotice
          }
        >
          <p className="text-sm leading-7 text-slate-300">
            {draft.limitationsNotice}
          </p>
        </DraftSection>
      </div>

      <p className="text-right text-xs text-slate-600">
        Draft generated{" "}
        {new Date(
          generatedAt
        ).toLocaleString()}
      </p>
    </div>
  );
}

function DraftList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <DraftSection
      title={title}
      copyText={items
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")}
    >
      {items.length > 0 ? (
        <ol className="space-y-3">
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
    </DraftSection>
  );
}

function DraftSection({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText: string;
  children: React.ReactNode;
}) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  async function copySection() {
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
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <SearchCheck
            size={17}
            className="text-purple-300"
          />
          {title}
        </h3>

        <button
          type="button"
          onClick={copySection}
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
      </div>

      {children}
    </section>
  );
}