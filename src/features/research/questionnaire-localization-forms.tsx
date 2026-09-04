"use client";

import type { ResearchQuestionnaireLocalizationStatus } from "@prisma/client";
import { useActionState } from "react";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeQuestionnaireLocalizationStatus,
  saveQuestionnaireLocalization,
} from "@/features/research/questionnaire-localization-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white";
const button =
  "rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

type Field = {
  id: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  options: string[];
};
type Localization = {
  id: string;
  locale: string;
  languageName: string;
  status: ResearchQuestionnaireLocalizationStatus;
  questionnaireName: string;
  purpose: string;
  consentStatement: string | null;
  instructions: string | null;
  fields: Record<
    string,
    {
      label?: string;
      description?: string;
      placeholder?: string;
      options?: Record<string, string>;
    }
  >;
};

export function QuestionnaireLocalizationWorkspace({
  collectionId,
  defaultLanguage,
  base,
  fields,
  localizations,
  canDesign,
  canPublish,
}: {
  collectionId: string;
  defaultLanguage: string;
  base: {
    questionnaireName: string;
    purpose: string;
    consentStatement: string | null;
    instructions: string | null;
  };
  fields: Field[];
  localizations: Localization[];
  canDesign: boolean;
  canPublish: boolean;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-violet-400/15 bg-violet-400/[.035] p-6">
      <p className="text-sm font-semibold text-violet-300">
        Multilingual collection
      </p>
      <h2 className="mt-1 text-2xl font-semibold">Questionnaire localizations</h2>
      <p className="mt-2 max-w-4xl text-sm text-slate-400">
        Translate respondent-facing wording while retaining the published field
        IDs and original option values used in governed analysis. Default
        language: <strong className="text-slate-200">{defaultLanguage}</strong>.
      </p>
      <div className="mt-5 space-y-4">
        {localizations.map((localization) => (
          <LocalizationEditor
            key={localization.id}
            collectionId={collectionId}
            base={base}
            fields={fields}
            localization={localization}
            canDesign={canDesign}
            canPublish={canPublish}
          />
        ))}
        {canDesign && (
          <LocalizationEditor
            collectionId={collectionId}
            base={base}
            fields={fields}
            localization={null}
            canDesign
            canPublish={canPublish}
          />
        )}
        {!localizations.length && !canDesign && (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
            No localized questionnaire variants have been created.
          </p>
        )}
      </div>
    </section>
  );
}

function LocalizationEditor({
  collectionId,
  base,
  fields,
  localization,
  canDesign,
  canPublish,
}: {
  collectionId: string;
  base: {
    questionnaireName: string;
    purpose: string;
    consentStatement: string | null;
    instructions: string | null;
  };
  fields: Field[];
  localization: Localization | null;
  canDesign: boolean;
  canPublish: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveQuestionnaireLocalization,
    initialFormActionState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    changeQuestionnaireLocalizationStatus,
    initialFormActionState,
  );
  useRefreshOnSuccess(state);
  useRefreshOnSuccess(statusState);
  return (
    <details
      open={!localization}
      className="rounded-2xl border border-white/10 bg-slate-950/45 p-5"
    >
      <summary className="cursor-pointer font-semibold">
        {localization
          ? `${localization.languageName} (${localization.locale}) · ${localization.status}`
          : "Add another language"}
      </summary>
      {canDesign && localization?.status !== "ARCHIVED" && (
        <form action={action} className="mt-5 space-y-5">
          <input type="hidden" name="collectionId" value={collectionId} />
          <div className="grid gap-4 md:grid-cols-2">
            <Label text="Language code">
              <input
                name="locale"
                required
                readOnly={Boolean(localization)}
                defaultValue={localization?.locale ?? ""}
                placeholder="fr, es, pt-br"
                className={input}
              />
            </Label>
            <Label text="Language name">
              <input
                name="languageName"
                required
                defaultValue={localization?.languageName ?? ""}
                placeholder="French"
                className={input}
              />
            </Label>
            <Label text="Questionnaire name">
              <input
                name="questionnaireName"
                required
                defaultValue={localization?.questionnaireName ?? ""}
                placeholder={base.questionnaireName}
                className={input}
              />
            </Label>
            <Label text="Translated purpose">
              <textarea
                name="purpose"
                required
                rows={3}
                defaultValue={localization?.purpose ?? ""}
                placeholder={base.purpose}
                className={input}
              />
            </Label>
            <Label text="Translated consent statement">
              <textarea
                name="consentStatement"
                rows={4}
                defaultValue={localization?.consentStatement ?? ""}
                placeholder={base.consentStatement ?? "Optional"}
                className={input}
              />
            </Label>
            <Label text="Translated collection instructions">
              <textarea
                name="instructions"
                rows={4}
                defaultValue={localization?.instructions ?? ""}
                placeholder={base.instructions ?? "Optional"}
                className={input}
              />
            </Label>
          </div>
          <div className="space-y-4">
            {fields.map((field) => {
              const translated = localization?.fields[field.id];
              return (
                <fieldset key={field.id} className="rounded-xl border border-white/10 p-4">
                  <legend className="px-2 text-sm font-semibold text-cyan-200">
                    {field.label}
                  </legend>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Label text="Translated question">
                      <input name={`label_${field.id}`} defaultValue={translated?.label ?? ""} placeholder={field.label} className={input} />
                    </Label>
                    <Label text="Translated help text">
                      <input name={`description_${field.id}`} defaultValue={translated?.description ?? ""} placeholder={field.description ?? "Optional"} className={input} />
                    </Label>
                    <Label text="Translated placeholder">
                      <input name={`placeholder_${field.id}`} defaultValue={translated?.placeholder ?? ""} placeholder={field.placeholder ?? "Optional"} className={input} />
                    </Label>
                  </div>
                  {field.options.length > 0 && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {field.options.map((option, index) => (
                        <Label key={option} text={`Option: ${option}`}>
                          <input name={`option_${field.id}_${index}`} defaultValue={translated?.options?.[option] ?? ""} placeholder={option} className={input} />
                        </Label>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
          <button disabled={pending} className={button}>
            {pending ? "Saving…" : localization ? "Save changes as draft" : "Create localization draft"}
          </button>
          <Feedback state={state} />
        </form>
      )}
      {localization && canPublish && localization.status !== "ARCHIVED" && (
        <form action={statusAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="collectionId" value={collectionId} />
          <input type="hidden" name="localizationId" value={localization.id} />
          {localization.status === "DRAFT" && (
            <button name="status" value="APPROVED" disabled={statusPending} className={button}>Approve for respondents</button>
          )}
          <button name="status" value="ARCHIVED" disabled={statusPending} className="rounded-xl border border-red-400/20 px-4 py-3 text-sm text-red-300">Archive</button>
          <Feedback state={statusState} />
        </form>
      )}
    </details>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return <label className="block text-sm text-slate-300">{text}{children}</label>;
}

function Feedback({ state }: { state: FormActionState }) {
  if (state.status === "IDLE") return null;
  return <p className={`text-sm ${state.status === "SUCCESS" ? "text-emerald-300" : "text-red-300"}`}>{state.message ?? ""}</p>;
}
