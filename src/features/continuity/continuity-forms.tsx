"use client";

import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import {
  activateContinuity,
  addContinuityDependency,
  cancelContinuityExercise,
  completeContinuityExercise,
  createCapaFromContinuityImprovement,
  createContinuityImprovement,
  createContinuityPlan,
  createContinuityPlanRevision,
  decideContinuityPlan,
  scheduleContinuityExercise,
  setBusinessImpactAnalysisActive,
  setContinuityDependencyActive,
  startContinuityExercise,
  submitContinuityPlan,
  transitionContinuityActivation,
  updateContinuityImprovement,
  updateContinuityPlan,
  updateContinuitySituation,
  upsertBusinessImpactAnalysis,
} from "@/features/continuity/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  continuityActivationNextStatuses,
  continuityImprovementNextStatuses,
} from "@/modules/continuity/continuity-lifecycle";
import {
  ContinuityActivationStatus,
  ContinuityCriticality,
  ContinuityDependencyType,
  ContinuityDisruptionCategory,
  ContinuityExerciseResult,
  ContinuityExerciseStatus,
  ContinuityExerciseType,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
  ContinuityPlanType,
  RiskLevel,
} from "@prisma/client";
import { useActionState, type ReactNode } from "react";

type Option = { id: string; name: string };
type SiteOption = Option;
type DepartmentOption = Option & { siteId: string; siteName: string };
type Forms = Parameters<typeof RuntimeFormFields>[0]["forms"];
const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/60 disabled:opacity-50";
const button = "mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50";
const card = "rounded-3xl border border-white/10 bg-white/[.04] p-6";

export type ContinuityPlanValues = {
  id: string;
  reference: string;
  title: string;
  type: ContinuityPlanType;
  siteId: string | null;
  departmentId: string | null;
  ownerId: string;
  scope: string;
  criticalActivitiesSummary: string;
  activationCriteria: string;
  governanceStructure: string;
  communicationStrategy: string;
  alternateWorkStrategy: string;
  technologyRecoveryStrategy: string;
  supplierContinuityStrategy: string | null;
  manualWorkarounds: string;
  recoveryPriorities: string;
  reviewDueAt: string;
};

export function ContinuityPlanForm({
  sites,
  departments,
  users,
  forms = [],
  plan,
}: {
  sites: SiteOption[];
  departments: DepartmentOption[];
  users: Option[];
  forms?: Forms;
  plan?: ContinuityPlanValues;
}) {
  const [state, action, pending] = useActionState(
    plan ? updateContinuityPlan : createContinuityPlan,
    initialFormActionState,
  );
  return <form action={action} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[.04] p-7">
    {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
    <section><h2 className="text-xl font-semibold">Plan identity and ownership</h2><div className="mt-4 grid gap-4 md:grid-cols-3">
      <Field name="reference" label="Plan reference" defaultValue={plan?.reference} readOnly={Boolean(plan)} required />
      <Field name="title" label="Plan title" defaultValue={plan?.title} required />
      <Select name="type" label="Plan type" values={Object.values(ContinuityPlanType)} defaultValue={plan?.type} required />
      <SelectOptions name="siteId" label="Site (optional)" options={sites} defaultValue={plan?.siteId ?? undefined} />
      <SelectOptions name="departmentId" label="Department (optional)" options={departments.map((item) => ({ id: item.id, name: `${item.name} · ${item.siteName}` }))} defaultValue={plan?.departmentId ?? undefined} />
      <SelectOptions name="ownerId" label="Plan owner" options={users} defaultValue={plan?.ownerId} required />
      <Field name="reviewDueAt" label="Next formal review" type="date" defaultValue={plan?.reviewDueAt} required />
    </div></section>
    <section><h2 className="text-xl font-semibold">Controlled recovery framework</h2><p className="mt-1 text-sm text-slate-400">Each required narrative must be substantive before approval.</p><div className="mt-4 grid gap-4 md:grid-cols-2">
      <Area name="scope" label="Plan scope" defaultValue={plan?.scope} required />
      <Area name="criticalActivitiesSummary" label="Critical activities summary" defaultValue={plan?.criticalActivitiesSummary} required />
      <Area name="activationCriteria" label="Activation criteria and authority" defaultValue={plan?.activationCriteria} required />
      <Area name="governanceStructure" label="Crisis and recovery governance" defaultValue={plan?.governanceStructure} required />
      <Area name="communicationStrategy" label="Stakeholder communication strategy" defaultValue={plan?.communicationStrategy} required />
      <Area name="alternateWorkStrategy" label="Alternate site and work strategy" defaultValue={plan?.alternateWorkStrategy} required />
      <Area name="technologyRecoveryStrategy" label="Technology and data recovery strategy" defaultValue={plan?.technologyRecoveryStrategy} required />
      <Area name="supplierContinuityStrategy" label="Supplier continuity strategy" defaultValue={plan?.supplierContinuityStrategy} />
      <Area name="manualWorkarounds" label="Manual workarounds" defaultValue={plan?.manualWorkarounds} required />
      <Area name="recoveryPriorities" label="Recovery sequence and priorities" defaultValue={plan?.recoveryPriorities} required />
    </div></section>
    {!plan ? <RuntimeFormFields forms={forms} /> : null}
    <Feedback state={state} />
    <button disabled={pending} className={button}>{pending ? "Saving…" : plan ? "Update Plan" : "Create Continuity Plan"}</button>
  </form>;
}

type BusinessImpactAnalysisValues = {
  id: string; ownerId: string; reference: string; processName: string; criticality: ContinuityCriticality;
  description: string; maximumTolerableDowntimeHours: number; recoveryTimeObjectiveHours: number;
  recoveryPointObjectiveHours: number; minimumStaff: number; peakPeriods: string | null;
  operationalImpact: string; financialImpact: string | null; legalRegulatoryImpact: string | null;
  customerStakeholderImpact: string | null; minimumResources: string; vitalRecords: string | null;
  recoveryStrategy: string; workaroundProcedure: string; reviewDueAt: string;
};

export function BusinessImpactAnalysisForm({ planId, users, analysis }: { planId: string; users: Option[]; analysis?: BusinessImpactAnalysisValues }) {
  return <ManagedForm action={upsertBusinessImpactAnalysis} title={analysis ? "Edit business impact analysis" : "Add business impact analysis"} submitLabel="Save BIA">
    <input type="hidden" name="planId" value={planId} />
    {analysis ? <input type="hidden" name="analysisId" value={analysis.id} /> : null}
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Field name="reference" label="BIA reference" defaultValue={analysis?.reference} readOnly={Boolean(analysis)} required />
      <Field name="processName" label="Critical process / service" defaultValue={analysis?.processName} required />
      <SelectOptions name="ownerId" label="Process owner" options={users} defaultValue={analysis?.ownerId} required />
      <Select name="criticality" label="Criticality tier" values={Object.values(ContinuityCriticality)} defaultValue={analysis?.criticality} required />
      <Field name="maximumTolerableDowntimeHours" label="MTPD (hours)" type="number" min={1} defaultValue={analysis?.maximumTolerableDowntimeHours} required />
      <Field name="recoveryTimeObjectiveHours" label="RTO (hours)" type="number" min={0} defaultValue={analysis?.recoveryTimeObjectiveHours} required />
      <Field name="recoveryPointObjectiveHours" label="RPO (hours)" type="number" min={0} defaultValue={analysis?.recoveryPointObjectiveHours} required />
      <Field name="minimumStaff" label="Minimum staffing" type="number" min={1} defaultValue={analysis?.minimumStaff ?? 1} required />
      <Field name="reviewDueAt" label="BIA review due" type="date" defaultValue={analysis?.reviewDueAt} required />
      <Field name="peakPeriods" label="Peak / blackout periods" defaultValue={analysis?.peakPeriods} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Area name="description" label="Process description" defaultValue={analysis?.description} required />
      <Area name="operationalImpact" label="Operational impact over time" defaultValue={analysis?.operationalImpact} required />
      <Area name="financialImpact" label="Financial impact" defaultValue={analysis?.financialImpact} />
      <Area name="legalRegulatoryImpact" label="Legal and regulatory impact" defaultValue={analysis?.legalRegulatoryImpact} />
      <Area name="customerStakeholderImpact" label="Customer and stakeholder impact" defaultValue={analysis?.customerStakeholderImpact} />
      <Area name="minimumResources" label="Minimum people, systems, facilities and equipment" defaultValue={analysis?.minimumResources} required />
      <Area name="vitalRecords" label="Vital records and data" defaultValue={analysis?.vitalRecords} />
      <Area name="recoveryStrategy" label="Recovery strategy" defaultValue={analysis?.recoveryStrategy} required />
      <Area name="workaroundProcedure" label="Interim workaround procedure" defaultValue={analysis?.workaroundProcedure} required />
    </div>
  </ManagedForm>;
}

export function BusinessImpactAnalysisAvailabilityForm({ planId, analysisId, active }: { planId: string; analysisId: string; active: boolean }) {
  return <ManagedForm action={setBusinessImpactAnalysisActive} title="BIA availability" submitLabel={active ? "Deactivate BIA" : "Reactivate BIA"} compact>
    <input type="hidden" name="planId" value={planId} /><input type="hidden" name="analysisId" value={analysisId} /><input type="hidden" name="active" value={String(!active)} />
  </ManagedForm>;
}

export function ContinuityDependencyForm({ planId, analysisId }: { planId: string; analysisId: string }) {
  return <ManagedForm action={addContinuityDependency} title="Add critical dependency" submitLabel="Add Dependency" compact>
    <input type="hidden" name="planId" value={planId} /><input type="hidden" name="analysisId" value={analysisId} />
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Select name="type" label="Dependency type" values={Object.values(ContinuityDependencyType)} required />
      <Field name="name" label="Dependency name" required />
      <Field name="provider" label="Provider / internal owner" />
      <Field name="contactDetails" label="Escalation contact" />
      <Field name="recoveryLeadTimeHours" label="Recovery lead time (hours)" type="number" min={0} />
      <Check name="isSinglePointFailure" label="Single point of failure" />
    </div>
    <Area name="description" label="Dependency description" />
    <Area name="fallbackArrangement" label="Fallback arrangement" required />
  </ManagedForm>;
}

export function ContinuityDependencyAvailabilityForm({ planId, dependencyId, active }: { planId: string; dependencyId: string; active: boolean }) {
  return <ManagedForm action={setContinuityDependencyActive} title="Dependency availability" submitLabel={active ? "Deactivate" : "Reactivate"} compact>
    <input type="hidden" name="planId" value={planId} /><input type="hidden" name="dependencyId" value={dependencyId} /><input type="hidden" name="active" value={String(!active)} />
  </ManagedForm>;
}

export function ContinuityPlanGovernanceForm({ planId, status }: { planId: string; status: ContinuityPlanStatus }) {
  if (status === ContinuityPlanStatus.DRAFT || status === ContinuityPlanStatus.REJECTED) {
    return <ManagedForm action={submitContinuityPlan} title="Submit controlled plan" submitLabel="Submit for Approval">
      <input type="hidden" name="planId" value={planId} /><Area name="submissionNotes" label="Validation performed, scope and changes" required />
    </ManagedForm>;
  }
  if (status === ContinuityPlanStatus.IN_REVIEW) {
    return <ManagedForm action={decideContinuityPlan} title="Plan approval decision" submitLabel="Record Decision">
      <input type="hidden" name="planId" value={planId} />
      <Select name="decision" label="Decision" values={[ContinuityPlanStatus.ACTIVE, ContinuityPlanStatus.REJECTED]} required />
      <Area name="reviewNotes" label="Review rationale and residual concerns" required />
    </ManagedForm>;
  }
  if (status === ContinuityPlanStatus.ACTIVE) {
    return <ManagedForm action={createContinuityPlanRevision} title="Controlled plan revision" submitLabel="Start New Version">
      <input type="hidden" name="planId" value={planId} /><Area name="reason" label="Revision reason and intended change" required />
    </ManagedForm>;
  }
  return null;
}

export function ContinuityExerciseScheduleForm({
  plans,
  users,
}: {
  plans: Array<{ id: string; name: string; analyses: Option[] }>;
  users: Option[];
}) {
  return <ManagedForm action={scheduleContinuityExercise} title="Schedule a continuity exercise" submitLabel="Schedule Exercise">
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <SelectOptions name="planId" label="Active plan" options={plans} required />
      <SelectOptions name="analysisId" label="Focused BIA (optional)" options={plans.flatMap((plan) => plan.analyses.map((analysis) => ({ id: analysis.id, name: `${plan.name} · ${analysis.name}` })))} />
      <SelectOptions name="leadId" label="Exercise lead" options={users} required />
      <Field name="reference" label="Exercise reference" required />
      <Select name="type" label="Exercise type" values={Object.values(ContinuityExerciseType)} required />
      <Field name="scheduledAt" label="Scheduled date and time" type="datetime-local" required />
      <Field name="expectedParticipants" label="Expected participants" type="number" min={1} defaultValue={1} required />
      <Field name="targetRecoveryTimeHours" label="Target RTO (hours)" type="number" min={0} />
      <Field name="targetRecoveryPointHours" label="Target RPO (hours)" type="number" min={0} />
    </div>
    <Area name="objectives" label="Exercise objectives" required />
    <Area name="scenario" label="Disruption scenario and injects" required />
  </ManagedForm>;
}

export function ContinuityExerciseLifecycleForm({ exerciseId, status }: { exerciseId: string; status: ContinuityExerciseStatus }) {
  if (status === ContinuityExerciseStatus.PLANNED) {
    return <div className="grid gap-5 xl:grid-cols-2">
      <ManagedForm action={startContinuityExercise} title="Start exercise" submitLabel="Start Exercise" compact>
        <input type="hidden" name="exerciseId" value={exerciseId} /><Area name="note" label="Start note and attendance confirmation" required />
      </ManagedForm>
      <ManagedForm action={cancelContinuityExercise} title="Cancel exercise" submitLabel="Cancel Exercise" compact>
        <input type="hidden" name="exerciseId" value={exerciseId} /><Area name="reason" label="Cancellation reason" required />
      </ManagedForm>
    </div>;
  }
  if (status === ContinuityExerciseStatus.IN_PROGRESS) {
    return <div className="grid gap-5 xl:grid-cols-2">
      <ManagedForm action={completeContinuityExercise} title="Complete and review exercise" submitLabel="Complete Exercise">
        <input type="hidden" name="exerciseId" value={exerciseId} />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field name="actualParticipants" label="Actual participants" type="number" min={1} required />
          <Select name="result" label="Overall result" values={Object.values(ContinuityExerciseResult)} required />
          <Field name="actualRecoveryTimeHours" label="Actual RTO (hours)" type="number" min={0} />
          <Field name="actualRecoveryPointHours" label="Actual RPO (hours)" type="number" min={0} />
        </div>
        <Area name="strengths" label="Demonstrated strengths" required />
        <Area name="gaps" label="Gaps and recovery-objective variances" required />
        <Area name="afterActionSummary" label="After-action summary" required />
      </ManagedForm>
      <ManagedForm action={cancelContinuityExercise} title="Stop exercise" submitLabel="Cancel Exercise" compact>
        <input type="hidden" name="exerciseId" value={exerciseId} /><Area name="reason" label="Cancellation reason" required />
      </ManagedForm>
    </div>;
  }
  return null;
}

export function ContinuityActivationForm({
  plans,
  users,
  emergencyActivations,
}: {
  plans: Option[];
  users: Option[];
  emergencyActivations: Option[];
}) {
  return <ManagedForm action={activateContinuity} title="Record business continuity activation" submitLabel="Activate Continuity Plan">
    <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
      This record governs business recovery. Life-safety response remains controlled through approved emergency procedures and emergency services.
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <SelectOptions name="planId" label="Active continuity plan" options={plans} required />
      <SelectOptions name="emergencyActivationId" label="Linked emergency event (optional)" options={emergencyActivations} />
      <SelectOptions name="coordinatorId" label="Recovery coordinator" options={users} required />
      <Field name="reference" label="Activation reference" required />
      <Select name="category" label="Disruption category" values={Object.values(ContinuityDisruptionCategory)} required />
      <Select name="severity" label="Business impact severity" values={Object.values(RiskLevel)} defaultValue={RiskLevel.HIGH} required />
      <Field name="title" label="Activation title" required />
      <Field name="location" label="Affected location / service" />
      <Field name="declaredAt" label="Declared at" type="datetime-local" required />
      <Field name="expectedRecoveryAt" label="Expected recovery" type="datetime-local" required />
      <Field name="afterActionDueAt" label="After-action due" type="datetime-local" required />
      <Field name="estimatedDowntimeHours" label="Estimated downtime (hours)" type="number" min={0} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Area name="disruptionSummary" label="Current disruption and verified facts" required />
      <Area name="impactedProcesses" label="Impacted processes, products and stakeholders" required />
      <Area name="activationRationale" label="Activation rationale and authority" required />
      <Area name="recoveryActions" label="Initial recovery actions" required />
      <Area name="stakeholderCommunication" label="Stakeholder communication" required />
      <Area name="workaroundStatus" label="Current workaround status" />
    </div>
  </ManagedForm>;
}

export function ContinuitySituationForm({ activation }: {
  activation: {
    id: string;
    disruptionSummary: string;
    impactedProcesses: string;
    recoveryActions: string;
    stakeholderCommunication: string;
    workaroundStatus: string | null;
    expectedRecoveryAt: string;
    estimatedDowntimeHours: number | null;
  };
}) {
  return <ManagedForm action={updateContinuitySituation} title="Update recovery situation" submitLabel="Update Situation">
    <input type="hidden" name="activationId" value={activation.id} />
    <div className="grid gap-4 md:grid-cols-2">
      <Area name="disruptionSummary" label="Current disruption and verified facts" defaultValue={activation.disruptionSummary} required />
      <Area name="impactedProcesses" label="Impacted processes" defaultValue={activation.impactedProcesses} required />
      <Area name="recoveryActions" label="Recovery actions and decisions" defaultValue={activation.recoveryActions} required />
      <Area name="stakeholderCommunication" label="Stakeholder communication" defaultValue={activation.stakeholderCommunication} required />
      <Area name="workaroundStatus" label="Workaround status" defaultValue={activation.workaroundStatus} />
      <Field name="expectedRecoveryAt" label="Expected recovery" type="datetime-local" defaultValue={activation.expectedRecoveryAt} required />
      <Field name="estimatedDowntimeHours" label="Estimated downtime (hours)" type="number" min={0} defaultValue={activation.estimatedDowntimeHours ?? undefined} />
    </div>
  </ManagedForm>;
}

export function ContinuityActivationLifecycleForm({ activationId, status }: { activationId: string; status: ContinuityActivationStatus }) {
  const next = continuityActivationNextStatuses(status);
  if (!next.length) return null;
  return <ManagedForm action={transitionContinuityActivation} title="Recovery lifecycle decision" submitLabel="Record Transition">
    <input type="hidden" name="activationId" value={activationId} />
    <Select name="status" label="Next status" values={next} required />
    <Area name="note" label="Decision rationale and authorization" required />
    {next.includes(ContinuityActivationStatus.RESTORED) ? <>
      <Area name="restorationEvidence" label="Restoration evidence and validation" />
      <Field name="actualDowntimeHours" label="Actual downtime (hours)" type="number" min={0} />
    </> : null}
    {next.includes(ContinuityActivationStatus.CLOSED) ? <>
      <Area name="closureSummary" label="After-action closure summary" />
      <Area name="lessonsLearned" label="Lessons learned" />
    </> : null}
  </ManagedForm>;
}

export function ContinuityImprovementForm({
  planId,
  users,
  exerciseId,
  activationId,
}: {
  planId: string;
  users: Option[];
  exerciseId?: string;
  activationId?: string;
}) {
  return <ManagedForm action={createContinuityImprovement} title="Create recovery improvement" submitLabel="Create Improvement">
    <input type="hidden" name="planId" value={planId} />
    {exerciseId ? <input type="hidden" name="exerciseId" value={exerciseId} /> : null}
    {activationId ? <input type="hidden" name="activationId" value={activationId} /> : null}
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <Field name="title" label="Improvement title" required />
      <SelectOptions name="ownerId" label="Action owner" options={users} required />
      <Select name="priority" label="Priority" values={Object.values(RiskLevel)} defaultValue={RiskLevel.MEDIUM} required />
      <Field name="dueAt" label="Due date" type="date" required />
    </div>
    <Area name="description" label="Required improvement and acceptance criteria" required />
  </ManagedForm>;
}

export function ContinuityImprovementLifecycleForm({
  improvement,
  canManage,
}: {
  improvement: { id: string; planId: string; status: ContinuityImprovementStatus };
  canManage: boolean;
}) {
  let next = continuityImprovementNextStatuses(improvement.status);
  if (!canManage) next = next.filter((status) => status !== ContinuityImprovementStatus.VERIFIED);
  if (!next.length) return null;
  return <ManagedForm action={updateContinuityImprovement} title="Update improvement" submitLabel="Update Status" compact>
    <input type="hidden" name="improvementId" value={improvement.id} /><input type="hidden" name="planId" value={improvement.planId} />
    <Select name="status" label="Next status" values={next} required />
    {next.includes(ContinuityImprovementStatus.COMPLETED) ? <Area name="completionEvidence" label="Completion evidence" /> : null}
    {next.includes(ContinuityImprovementStatus.VERIFIED) ? <Area name="verificationNotes" label="Verification notes" /> : null}
  </ManagedForm>;
}

export function ContinuityImprovementCapaForm({
  improvement,
  users,
}: {
  improvement: { id: string; planId: string; title: string; description: string; dueAt: Date };
  users: Option[];
}) {
  return <ManagedForm action={createCapaFromContinuityImprovement} title="Link corrective action" submitLabel="Create CAPA" compact>
    <input type="hidden" name="improvementId" value={improvement.id} /><input type="hidden" name="planId" value={improvement.planId} />
    <Field name="title" label="Corrective-action title" defaultValue={improvement.title} required />
    <Area name="description" label="Corrective-action description" defaultValue={improvement.description} />
    <SelectOptions name="assignedToId" label="Assigned owner" options={users} required />
    <Field name="dueDate" label="Due date" type="date" defaultValue={improvement.dueAt.toISOString().slice(0, 10)} required />
  </ManagedForm>;
}

function ManagedForm({
  action,
  title,
  submitLabel,
  children,
  compact = false,
}: {
  action: (state: FormActionState, data: FormData) => Promise<FormActionState>;
  title: string;
  submitLabel: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormActionState);
  return <form action={formAction} className={compact ? "mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4" : `${card} mt-6`}>
    <h3 className={compact ? "font-semibold" : "text-lg font-semibold"}>{title}</h3>
    {children}
    <Feedback state={state} />
    <button disabled={pending} className={button}>{pending ? "Saving…" : submitLabel}</button>
  </form>;
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required: isRequired,
  readOnly,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  readOnly?: boolean;
  min?: number;
}) {
  return <label className="block text-sm text-slate-300">{label}
    <input className={input} name={name} type={type} defaultValue={defaultValue ?? undefined} required={isRequired} readOnly={readOnly} min={min} />
  </label>;
}

function Area({
  name,
  label,
  defaultValue,
  required: isRequired,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return <label className="mt-4 block text-sm text-slate-300">{label}
    <textarea className={`${input} min-h-28`} name={name} defaultValue={defaultValue ?? undefined} required={isRequired} />
  </label>;
}

function Select({
  name,
  label,
  values,
  defaultValue,
  required: isRequired,
}: {
  name: string;
  label: string;
  values: readonly string[];
  defaultValue?: string;
  required?: boolean;
}) {
  return <label className="block text-sm text-slate-300">{label}
    <select className={input} name={name} defaultValue={defaultValue ?? ""} required={isRequired}>
      <option value="">Select…</option>
      {values.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
    </select>
  </label>;
}

function SelectOptions({
  name,
  label,
  options,
  defaultValue,
  required: isRequired,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
}) {
  return <label className="block text-sm text-slate-300">{label}
    <select className={input} name={name} defaultValue={defaultValue ?? ""} required={isRequired}>
      <option value="">Select…</option>
      {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>;
}

function Check({ name, label }: { name: string; label: string }) {
  return <label className="mt-8 flex items-center gap-3 text-sm text-slate-300">
    <input type="checkbox" name={name} className="h-4 w-4 accent-cyan-300" />{label}
  </label>;
}

function Feedback({ state }: { state: FormActionState }) {
  if (!state.message) return null;
  return <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${state.status === "ERROR" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{state.message}</p>;
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
