"use client";

import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import { addResearchMilestone, assignResearchTeamMember, changeResearchProjectStatus, createResearchClient, createResearchProject, createResearchQuestionnaire } from "@/features/research/actions";
import { ResearchDataClassification, ResearchMethodology, ResearchProjectStatus, ResearchResponseIdentityMode, ResearchTeamRole } from "@prisma/client";
import { useActionState } from "react";

const field = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60";
const button = "rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

type UserOption = { id: string; name: string; jobTitle: string | null };
type ClientOption = { id: string; name: string };

export function ResearchClientForm() {
  const [state, action, pending] = useActionState(createResearchClient, initialFormActionState);
  return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Client name"><input name="name" required maxLength={160} className={field}/></Field>
      <Field label="Legal name"><input name="legalName" maxLength={200} className={field}/></Field>
      <Field label="Client code"><input name="code" maxLength={30} className={field}/></Field>
      <Field label="Industry"><input name="industry" maxLength={120} className={field}/></Field>
      <Field label="Country"><input name="country" maxLength={120} className={field}/></Field>
      <Field label="Website"><input name="website" type="url" maxLength={500} className={field}/></Field>
      <Field label="Primary contact"><input name="primaryContactName" maxLength={160} className={field}/></Field>
      <Field label="Primary contact email"><input name="primaryContactEmail" type="email" maxLength={254} className={field}/></Field>
      <Field label="Legal data owner"><input name="dataOwnerName" maxLength={200} className={field}/></Field>
      <Field label="Data-owner email"><input name="dataOwnerEmail" type="email" maxLength={254} className={field}/></Field>
      <Field label="Default classification"><select name="dataClassification" defaultValue={ResearchDataClassification.CONFIDENTIAL} className={field}>{Object.values(ResearchDataClassification).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
      <Field label="Retention period (days)"><input name="retentionDays" type="number" min={1} max={36500} className={field}/></Field>
    </div>
    <Field label="Contractual and data-use notes"><textarea name="contractualNotes" rows={4} maxLength={4000} className={field}/></Field>
    <button disabled={pending} className={`mt-5 ${button}`}>{pending ? "Saving…" : "Create governed client"}</button><Feedback state={state}/>
  </form>;
}

export function ResearchProjectForm({users, clients}:{users:UserOption[];clients:ClientOption[]}) {
  const [state, action, pending] = useActionState(createResearchProject, initialFormActionState);
  return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Project reference"><input name="reference" required minLength={3} maxLength={40} placeholder="RES-2026-001" className={field}/></Field>
      <Field label="Project title"><input name="title" required maxLength={220} className={field}/></Field>
      <Field label="Commissioning client"><select name="clientId" defaultValue="" className={field}><option value="">Internal research — no external client</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
      <Field label="Methodology"><select name="methodology" defaultValue={ResearchMethodology.MIXED_METHODS} className={field}>{Object.values(ResearchMethodology).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
      <Field label="Project manager"><select name="projectManagerId" required defaultValue="" className={field}><option value="" disabled>Select accountable manager</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field>
      <Field label="Principal investigator"><select name="principalInvestigatorId" defaultValue="" className={field}><option value="">Not assigned</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field>
      <Field label="Data classification"><select name="dataClassification" defaultValue={ResearchDataClassification.CONFIDENTIAL} className={field}>{Object.values(ResearchDataClassification).map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
      <Field label="Sample target"><input name="sampleTarget" type="number" min={1} className={field}/></Field>
      <Field label="Start date"><input name="startDate" type="date" className={field}/></Field>
      <Field label="Due date"><input name="dueDate" type="date" className={field}/></Field>
      <Field label="Target population"><input name="targetPopulation" maxLength={500} className={field}/></Field>
      <Field label="Geographic scope"><input name="geographicScope" maxLength={500} className={field}/></Field>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <Field label="Research purpose"><textarea name="purpose" required minLength={20} maxLength={4000} rows={5} className={field}/></Field>
      <Field label="Objectives"><textarea name="objectives" required minLength={20} maxLength={6000} rows={5} className={field}/></Field>
      <Field label="Research questions"><textarea name="researchQuestions" required minLength={10} maxLength={8000} rows={5} className={field}/></Field>
      <Field label="Hypotheses"><textarea name="hypotheses" maxLength={6000} rows={5} className={field}/></Field>
      <Field label="Sampling strategy"><textarea name="samplingStrategy" maxLength={4000} rows={4} className={field}/></Field>
      <Field label="Intended use"><textarea name="intendedUse" maxLength={4000} rows={4} className={field}/></Field>
      <Field label="Data ownership statement"><textarea name="dataOwnershipStatement" maxLength={4000} rows={4} placeholder="Required for commissioned research" className={field}/></Field>
      <Field label="Confidentiality terms"><textarea name="confidentialityTerms" maxLength={4000} rows={4} className={field}/></Field>
      <Field label="Retention period (days)"><input name="retentionDays" type="number" min={1} max={36500} className={field}/></Field>
      <Field label="Ethics approval reference"><input name="ethicsApprovalReference" maxLength={200} className={field}/></Field>
    </div>
    <div className="mt-5 flex flex-wrap gap-6 text-sm text-slate-300"><label className="flex items-center gap-2"><input name="ethicsApprovalRequired" type="checkbox"/> Ethics approval required</label><label className="flex items-center gap-2"><input name="consentRequired" type="checkbox"/> Participant consent required</label></div>
    <button disabled={pending} className={`mt-6 ${button}`}>{pending ? "Creating…" : "Create governed research project"}</button><Feedback state={state}/>
  </form>;
}

export function ResearchTeamForm({projectId,users}:{projectId:string;users:UserOption[]}) {
  const [state, action, pending] = useActionState(assignResearchTeamMember, initialFormActionState);
  return <form action={action} className="space-y-4"><input type="hidden" name="projectId" value={projectId}/><Field label="Team member"><select name="userId" required defaultValue="" className={field}><option value="" disabled>Select person</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}</option>)}</select></Field><Field label="Research role"><select name="role" defaultValue={ResearchTeamRole.RESEARCHER} className={field}>{Object.values(ResearchTeamRole).map(value=><option value={value} key={value}>{pretty(value)}</option>)}</select></Field><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="isLead"/> Lead responsibility</label><button disabled={pending} className={button}>{pending ? "Assigning…" : "Assign or update"}</button><Feedback state={state}/></form>;
}

export function ResearchMilestoneForm({projectId,users}:{projectId:string;users:UserOption[]}) {
  const [state, action, pending] = useActionState(addResearchMilestone, initialFormActionState);
  return <form action={action} className="space-y-4"><input type="hidden" name="projectId" value={projectId}/><Field label="Milestone"><input name="title" required maxLength={220} className={field}/></Field><Field label="Description"><textarea name="description" rows={3} maxLength={2000} className={field}/></Field><Field label="Owner"><select name="ownerId" defaultValue="" className={field}><option value="">Unassigned</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Due date"><input name="dueDate" type="date" className={field}/></Field><button disabled={pending} className={button}>{pending ? "Adding…" : "Add milestone"}</button><Feedback state={state}/></form>;
}

export function ResearchStatusForm({projectId,statuses}:{projectId:string;statuses:ResearchProjectStatus[]}) {
  const [state, action, pending] = useActionState(changeResearchProjectStatus, initialFormActionState);
  if (!statuses.length) return null;
  return <form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="projectId" value={projectId}/><Field label="Governed next status"><select name="status" className={field}>{statuses.map(value=><option key={value} value={value}>{pretty(value)}</option>)}</select></Field><button disabled={pending} className={button}>{pending ? "Updating…" : "Apply transition"}</button><Feedback state={state}/></form>;
}

export function ResearchQuestionnaireForm({projectId,consentRequired}:{projectId:string;consentRequired:boolean}) {
  const [state, action, pending] = useActionState(createResearchQuestionnaire, initialFormActionState);
  return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><input type="hidden" name="projectId" value={projectId}/><div className="grid gap-5 md:grid-cols-2"><Field label="Questionnaire name"><input name="name" required maxLength={160} className={field}/></Field><Field label="Respondent identity mode"><select name="identityMode" defaultValue={ResearchResponseIdentityMode.PSEUDONYMIZED} className={field}>{Object.values(ResearchResponseIdentityMode).map(value=><option value={value} key={value}>{pretty(value)}</option>)}</select></Field><Field label="Target audience"><input name="targetAudience" maxLength={500} className={field}/></Field><Field label="Default language code"><input name="defaultLanguage" defaultValue="en" maxLength={12} className={field}/></Field></div><Field label="Questionnaire purpose"><textarea name="purpose" required minLength={10} maxLength={3000} rows={4} className={field}/></Field><Field label={`Participant consent statement${consentRequired?" — required":""}`}><textarea name="consentStatement" required={consentRequired} maxLength={6000} rows={5} className={field}/></Field><p className="mt-4 text-sm text-slate-500">A controlled Form Studio draft will be created and linked to this project. Published versions remain immutable.</p><button disabled={pending} className={`mt-5 ${button}`}>{pending?"Creating…":"Create and open Questionnaire Studio"}</button><Feedback state={state}/></form>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block text-sm text-slate-300"><span className="font-medium text-slate-200">{label}</span>{children}</label>; }
function Feedback({state}:{state:FormActionState}) { if (state.status === "IDLE") return null; return <p role="status" className={`mt-4 text-sm ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{state.message}</p>; }
function pretty(value:string){return value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());}
