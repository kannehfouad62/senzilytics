"use client";

import {
  saveEnterpriseAuditResponse,
  type AuditExecutionActionResult,
  type SavedAuditResponseActionData,
} from "@/features/audits/actions";
import {
  EnterpriseAuditResponseResult,
} from "@prisma/client";
import { EnterpriseAuditQuestionEvidence } from "./enterprise-audit-question-evidence";
import { EnterpriseAuditHistoryTimeline } from "./enterprise-audit-history-timeline";
import { EnterpriseAuditFindingsPanel } from "./enterprise-audit-findings-panel";
import { EnterpriseAuditCompletionPanel } from "../../audit/[id]/enterprise-audit-completion-panel";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Loader2,
  Save,
} from "lucide-react";
import Link from "next/link";
import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type OptionViewModel = {
  id: string;
  label: string;
  value: string;
  description: string | null;
  scoreValue: string | null;
  isPassing: boolean | null;
  triggersFinding: boolean;
  findingSeverity: string | null;
};

type ResponseViewModel = {
  id: string;
  result: EnterpriseAuditResponseResult;
  responseText: string | null;
  numericValue: string | null;
  booleanValue: boolean | null;
  selectedOptionValues: string[];
  comments: string | null;
  scoreAwarded: string | null;
  maximumScore: string | null;
  isCompliant: boolean | null;
  requiresFollowUp: boolean;
  answeredAt: string | null;
  evidenceCount: number;
  findingCount: number;
};

type QuestionViewModel = {
  id: string;
  questionText: string;
  description: string | null;
  guidance: string | null;
  standardClause: string | null;
  regulatoryRef: string | null;
  responseType: string;
  sequence: number;
  weight: number;
  isRequired: boolean;
  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;
  minimumNumericValue: string | null;
  maximumNumericValue: string | null;
  minimumPassingScore: string | null;
  maximumScore: string | null;
  automaticallyCreateFinding: boolean;
  automaticallySuggestCapa: boolean;
  automaticallySuggestRisk: boolean;
  status: string;
  options: OptionViewModel[];
  response: ResponseViewModel | null;
  evidenceCount: number;
  findingCount: number;
};

type SectionViewModel = {
  id: string;
  title: string;
  sequence: number;
  status: string;
  isRequired: boolean;
  totalQuestionCount: number;
  answeredQuestionCount: number;
  failedQuestionCount: number;
  maximumPossibleScore: string | null;
  achievedScore: string | null;
  scorePercentage: string | null;
  questions: QuestionViewModel[];
};

export type EnterpriseAuditExecutionViewModel = {
  id: string;
  reference: string;
  title: string;
  status: string;
  locked: boolean;
  totalQuestionCount: number;
  answeredQuestionCount: number;
  failedQuestionCount: number;
  maximumPossibleScore: string | null;
  achievedScore: string | null;
  scorePercentage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sections: SectionViewModel[];
};

type QuestionDraft = {
  result: EnterpriseAuditResponseResult;
  responseText: string;
  numericValue: string;
  booleanValue: string;
  selectedOptionValues: string[];
  comments: string;
};

function createDraft(
  question: QuestionViewModel
): QuestionDraft {
  return {
    result:
      question.response?.result ??
      EnterpriseAuditResponseResult
        .NOT_ASSESSED,
    responseText:
      question.response?.responseText ??
      "",
    numericValue:
      question.response?.numericValue ??
      "",
    booleanValue:
      question.response?.booleanValue ===
      null ||
      question.response?.booleanValue ===
      undefined
        ? ""
        : String(
            question.response.booleanValue
          ),
    selectedOptionValues:
      question.response
        ?.selectedOptionValues ?? [],
    comments:
      question.response?.comments ?? "",
  };
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function percent(
  value: string | null
) {
  if (!value) {
    return "0%";
  }

  return `${Number(value).toFixed(1)}%`;
}

function responseResultOptions(
  question: QuestionViewModel
) {
  return Object.values(
    EnterpriseAuditResponseResult
  ).filter(
    (result) =>
      question.allowNotApplicable ||
      result !==
        EnterpriseAuditResponseResult.NOT_APPLICABLE
  );
}

export function EnterpriseAuditExecutionClient({
  initialAudit,
}: {
  initialAudit: EnterpriseAuditExecutionViewModel;
}) {
  const [audit, setAudit] =
    useState(initialAudit);

  const [historyRefreshKey, setHistoryRefreshKey] =
    useState(() => new Date().toISOString());

  const [drafts, setDrafts] = useState<
    Record<string, QuestionDraft>
  >(() =>
    Object.fromEntries(
      initialAudit.sections.flatMap(
        (section) =>
          section.questions.map(
            (question) => [
              question.id,
              createDraft(question),
            ]
          )
      )
    )
  );

  const [messages, setMessages] =
    useState<
      Record<
        string,
        {
          success: boolean;
          message: string;
        }
      >
    >({});

  const [savingQuestionId, setSavingQuestionId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const progress = useMemo(() => {
    if (audit.totalQuestionCount === 0) {
      return 0;
    }

    return Math.round(
      (audit.answeredQuestionCount /
        audit.totalQuestionCount) *
        100
    );
  }, [
    audit.answeredQuestionCount,
    audit.totalQuestionCount,
  ]);

  function updateDraft(
    questionId: string,
    update: Partial<QuestionDraft>
  ) {
    setDrafts((current) => ({
      ...current,
      [questionId]: {
        ...current[questionId],
        ...update,
      },
    }));
  }

  function toggleOption(
    questionId: string,
    value: string,
    multiple: boolean
  ) {
    const current =
      drafts[questionId]
        ?.selectedOptionValues ?? [];

    updateDraft(questionId, {
      selectedOptionValues: multiple
        ? current.includes(value)
          ? current.filter(
              (item) => item !== value
            )
          : [...current, value]
        : [value],
    });
  }

  function applySavedProgress(
    questionId: string,
    result:
      AuditExecutionActionResult<SavedAuditResponseActionData>
  ) {
    if (!result.success || !result.data) {
      return;
    }

    const data = result.data;

    setAudit((current) => ({
      ...current,
      status: data.auditProgress.status,
      answeredQuestionCount:
        data.auditProgress
          .answeredQuestionCount,
      failedQuestionCount:
        data.auditProgress
          .failedQuestionCount,
      achievedScore:
        data.auditProgress.achievedScore,
      maximumPossibleScore:
        data.auditProgress
          .maximumPossibleScore,
      scorePercentage:
        data.auditProgress.scorePercentage,
      sections: current.sections.map(
        (section) =>
          section.id === data.sectionId
            ? {
                ...section,
                status:
                  data.sectionProgress
                    .status,
                answeredQuestionCount:
                  data.sectionProgress
                    .answeredQuestionCount,
                failedQuestionCount:
                  data.sectionProgress
                    .failedQuestionCount,
                achievedScore:
                  data.sectionProgress
                    .achievedScore,
                maximumPossibleScore:
                  data.sectionProgress
                    .maximumPossibleScore,
                scorePercentage:
                  data.sectionProgress
                    .scorePercentage,
                questions:
                  section.questions.map(
                    (question) =>
                      question.id ===
                      questionId
                        ? {
                            ...question,
                            response: {
                              id:
                                data.responseId,
                              result:
                                data.result,
                              responseText:
                                drafts[
                                  questionId
                                ]
                                  .responseText ||
                                null,
                              numericValue:
                                drafts[
                                  questionId
                                ]
                                  .numericValue ||
                                null,
                              booleanValue:
                                drafts[
                                  questionId
                                ]
                                  .booleanValue ===
                                ""
                                  ? null
                                  : drafts[
                                        questionId
                                      ]
                                        .booleanValue ===
                                      "true",
                              selectedOptionValues:
                                drafts[
                                  questionId
                                ]
                                  .selectedOptionValues,
                              comments:
                                drafts[
                                  questionId
                                ]
                                  .comments ||
                                null,
                              scoreAwarded:
                                data.scoreAwarded,
                              maximumScore:
                                data.maximumScore,
                              isCompliant:
                                data.isCompliant,
                              requiresFollowUp:
                                data.requiresFollowUp,
                              answeredAt:
                                new Date().toISOString(),
                              evidenceCount:
                                question
                                  .response
                                  ?.evidenceCount ??
                                0,
                              findingCount:
                                (question
                                  .response
                                  ?.findingCount ??
                                  0) +
                                (data.automaticFindingId
                                  ? 1
                                  : 0),
                            },
                          }
                        : question
                  ),
              }
            : section
      ),
    }));
  }

  function saveQuestion(
    question: QuestionViewModel
  ) {
    const draft = drafts[question.id];

    if (!draft) {
      return;
    }

    const formData = new FormData();

    formData.set("auditId", audit.id);
    formData.set(
      "questionId",
      question.id
    );
    formData.set("result", draft.result);

    if (draft.responseText.trim()) {
      formData.set(
        "responseText",
        draft.responseText
      );
    }

    if (draft.numericValue.trim()) {
      formData.set(
        "numericValue",
        draft.numericValue
      );
    }

    if (draft.booleanValue) {
      formData.set(
        "booleanValue",
        draft.booleanValue
      );
    }

    for (const value of
      draft.selectedOptionValues) {
      formData.append(
        "selectedOptionValues",
        value
      );
    }

    if (draft.comments.trim()) {
      formData.set(
        "comments",
        draft.comments
      );
    }

    setSavingQuestionId(question.id);
    setMessages((current) => {
      const next = { ...current };
      delete next[question.id];
      return next;
    });

    startTransition(async () => {
      const result =
        await saveEnterpriseAuditResponse(
          formData
        );

      setMessages((current) => ({
        ...current,
        [question.id]: {
          success: result.success,
          message: result.message,
        },
      }));

      applySavedProgress(
        question.id,
        result
      );

      if (result.success) {
        setHistoryRefreshKey(
          new Date().toISOString()
        );
      }

      setSavingQuestionId(null);
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/audit-management/audit"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to enterprise audits
      </Link>

      <header className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-cyan-300">
              {audit.reference}
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              {audit.title}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {formatLabel(audit.status)}
            </p>
          </div>

          {audit.locked && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
              Audit locked
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Progress"
            value={`${progress}%`}
          />
          <MetricCard
            label="Answered"
            value={`${audit.answeredQuestionCount}/${audit.totalQuestionCount}`}
          />
          <MetricCard
            label="Failed"
            value={String(
              audit.failedQuestionCount
            )}
          />
          <MetricCard
            label="Score"
            value={percent(
              audit.scorePercentage
            )}
          />
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </header>

      <EnterpriseAuditCompletionPanel
        auditId={audit.id}
        locked={audit.locked}
        onCompleted={(readiness) => {
          setAudit((current) => ({
            ...current,
            status: readiness.status,
            locked:
              readiness.status ===
                "PENDING_REVIEW" ||
              readiness.status ===
                "COMPLETED" ||
              readiness.status ===
                "CLOSED" ||
              readiness.status ===
                "CANCELLED",
            completedAt:
              readiness.completedAt,
          }));

          setHistoryRefreshKey(
            new Date().toISOString()
          );
        }}
      />

      <EnterpriseAuditFindingsPanel
        auditId={audit.id}
        locked={audit.locked}
        onChanged={() =>
          setHistoryRefreshKey(
            new Date().toISOString()
          )
        }
      />

      <EnterpriseAuditHistoryTimeline
        auditId={audit.id}
        refreshKey={historyRefreshKey}
      />

      {audit.sections.map((section) => (
        <section
          key={section.id}
          className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Section {section.sequence}
              </p>

              <h2 className="mt-2 text-xl font-semibold text-white">
                {section.title}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>
                {formatLabel(
                  section.status
                )}
              </Badge>
              <Badge>
                {
                  section
                    .answeredQuestionCount
                }
                /{section.totalQuestionCount} answered
              </Badge>
              <Badge>
                {percent(
                  section.scorePercentage
                )}
              </Badge>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {section.questions.map(
              (question) => {
                const draft =
                  drafts[question.id] ??
                  createDraft(question);

                const message =
                  messages[question.id];

                const multiple =
                  question.responseType
                    .toUpperCase()
                    .includes("MULTI");

                return (
                  <article
                    id={`question-${question.id}`}
                    key={question.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <p className="text-xs text-slate-500">
                          Question{" "}
                          {question.sequence}
                        </p>

                        <h3 className="mt-2 font-medium text-white">
                          {
                            question.questionText
                          }
                        </h3>

                        {question.description && (
                          <p className="mt-2 text-sm text-slate-400">
                            {
                              question.description
                            }
                          </p>
                        )}

                        {question.guidance && (
                          <p className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs text-cyan-100">
                            {
                              question.guidance
                            }
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge>
                          Weight{" "}
                          {question.weight}
                        </Badge>

                        {question.isRequired && (
                          <Badge>
                            Required
                          </Badge>
                        )}

                        {question
                          .automaticallyCreateFinding && (
                          <Badge>
                            Auto finding
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Field label="Result">
                        <select
                          value={draft.result}
                          onChange={(event) =>
                            updateDraft(
                              question.id,
                              {
                                result:
                                  event.target
                                    .value as EnterpriseAuditResponseResult,
                              }
                            )
                          }
                          disabled={
                            audit.locked ||
                            isPending
                          }
                          className={inputClass}
                        >
                          {responseResultOptions(
                            question
                          ).map(
                            (result) => (
                              <option
                                key={result}
                                value={result}
                              >
                                {formatLabel(
                                  result
                                )}
                              </option>
                            )
                          )}
                        </select>
                      </Field>

                      <Field label="Numeric value">
                        <input
                          type="number"
                          step="any"
                          min={
                            question.minimumNumericValue ??
                            undefined
                          }
                          max={
                            question.maximumNumericValue ??
                            undefined
                          }
                          value={
                            draft.numericValue
                          }
                          onChange={(event) =>
                            updateDraft(
                              question.id,
                              {
                                numericValue:
                                  event.target
                                    .value,
                              }
                            )
                          }
                          disabled={
                            audit.locked ||
                            isPending
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-4">
                      <Field label="Boolean response">
                        <select
                          value={
                            draft.booleanValue
                          }
                          onChange={(event) =>
                            updateDraft(
                              question.id,
                              {
                                booleanValue:
                                  event.target
                                    .value,
                              }
                            )
                          }
                          disabled={
                            audit.locked ||
                            isPending
                          }
                          className={inputClass}
                        >
                          <option value="">
                            Not provided
                          </option>
                          <option value="true">
                            Yes / True
                          </option>
                          <option value="false">
                            No / False
                          </option>
                        </select>
                      </Field>
                    </div>

                    {question.options.length >
                      0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm text-slate-300">
                          Response options
                        </p>

                        <div className="grid gap-2 md:grid-cols-2">
                          {question.options.map(
                            (option) => {
                              const checked =
                                draft.selectedOptionValues.includes(
                                  option.value
                                );

                              return (
                                <label
                                  key={
                                    option.id
                                  }
                                  className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200"
                                >
                                  <input
                                    type={
                                      multiple
                                        ? "checkbox"
                                        : "radio"
                                    }
                                    name={`option-${question.id}`}
                                    checked={
                                      checked
                                    }
                                    onChange={() =>
                                      toggleOption(
                                        question.id,
                                        option.value,
                                        multiple
                                      )
                                    }
                                    disabled={
                                      audit.locked ||
                                      isPending
                                    }
                                  />

                                  <span>
                                    <span className="block">
                                      {
                                        option.label
                                      }
                                    </span>

                                    {option.description && (
                                      <span className="mt-1 block text-xs text-slate-500">
                                        {
                                          option.description
                                        }
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <Field label="Response or evidence summary">
                        <textarea
                          rows={3}
                          value={
                            draft.responseText
                          }
                          onChange={(event) =>
                            updateDraft(
                              question.id,
                              {
                                responseText:
                                  event.target
                                    .value,
                              }
                            )
                          }
                          disabled={
                            audit.locked ||
                            isPending
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-4">
                      <Field
                        label={`Comments${
                          question.requireComment
                            ? " *"
                            : ""
                        }`}
                      >
                        <textarea
                          rows={2}
                          value={draft.comments}
                          onChange={(event) =>
                            updateDraft(
                              question.id,
                              {
                                comments:
                                  event.target
                                    .value,
                              }
                            )
                          }
                          disabled={
                            audit.locked ||
                            isPending
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <EnterpriseAuditQuestionEvidence
                      auditId={audit.id}
                      questionId={question.id}
                      locked={audit.locked}
                      requireEvidence={
                        question.requireEvidence
                      }
                      requirePhoto={
                        question.requirePhoto
                      }
                      initialCount={
                        question.response
                          ?.evidenceCount ??
                        question.evidenceCount
                      }
                    />

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {question.requireEvidence && (
                          <Badge>
                            Evidence required
                          </Badge>
                        )}

                        {question.requirePhoto && (
                          <Badge>
                            Photo required
                          </Badge>
                        )}

                        {(question.response
                          ?.findingCount ??
                          question.findingCount) >
                          0 && (
                          <Badge>
                            <FileWarning
                              size={13}
                            />
                            Finding linked
                          </Badge>
                        )}

                        {question.response
                          ?.isCompliant ===
                          true && (
                          <Badge>
                            <CheckCircle2
                              size={13}
                            />
                            Compliant
                          </Badge>
                        )}

                        {question.response
                          ?.requiresFollowUp && (
                          <Badge>
                            <AlertTriangle
                              size={13}
                            />
                            Follow-up
                          </Badge>
                        )}
                      </div>

                      {!audit.locked && (
                        <button
                          type="button"
                          onClick={() =>
                            saveQuestion(
                              question
                            )
                          }
                          disabled={
                            isPending &&
                            savingQuestionId ===
                              question.id
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending &&
                          savingQuestionId ===
                            question.id ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Save
                              size={16}
                            />
                          )}

                          Save response
                        </button>
                      )}
                    </div>

                    {message && (
                      <p
                        className={`mt-4 rounded-xl border p-3 text-sm ${
                          message.success
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border-red-400/20 bg-red-400/10 text-red-200"
                        }`}
                      >
                        {message.message}
                      </p>
                    )}
                  </article>
                );
              }
            )}
          </div>
        </section>
      ))}

      {audit.sections.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
          <ClipboardCheck className="mx-auto text-slate-500" />
          <p className="mt-3 text-slate-400">
            This audit does not contain any active execution sections.
          </p>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function Badge({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
