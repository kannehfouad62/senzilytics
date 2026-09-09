"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import { validateResearchQuestionnaireTest } from "@/features/research/questionnaire-test-actions";
import { useActionState } from "react";

type RuntimeForm=Parameters<typeof RuntimeFormFields>[0]["forms"][number];
export function QuestionnaireTestForm({form}:{form:RuntimeForm}){
  const[state,action,pending]=useActionState(validateResearchQuestionnaireTest,initialFormActionState);
  return <form action={action} aria-busy={pending} className="mt-8 space-y-5"><input type="hidden" name="definitionId" value={form.id}/><input type="hidden" name="versionId" value={form.version.id}/><div className="rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-5"><p className="font-semibold text-amber-200">Test mode — responses are never collected</p><p className="mt-1 text-sm text-slate-300">Exercise branching, required fields, structured questions, rosters, and calculations exactly as a respondent would. Passing this test does not publish the questionnaire.</p></div><RuntimeFormFields forms={[form]}/>{state.message&&<p role={state.status==="ERROR"?"alert":"status"} className={`rounded-xl border p-4 text-sm ${state.status==="ERROR"?"border-red-400/20 bg-red-400/10 text-red-300":"border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{state.message}</p>}<button disabled={pending} className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{pending?"Validating test…":"Validate test response"}</button><p className="text-xs text-slate-500">Only a validation audit event is retained. Answer values are not stored.</p></form>;
}
