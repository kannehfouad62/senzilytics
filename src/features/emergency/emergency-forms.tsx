"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  activateEmergencyResponse,
  addEmergencyContact,
  addEmergencyScenario,
  cancelEmergencyDrill,
  completeEmergencyDrill,
  createCapaFromEmergencyImprovement,
  createEmergencyImprovement,
  createEmergencyPlan,
  createEmergencyPlanRevision,
  decideEmergencyPlan,
  scheduleEmergencyDrill,
  setEmergencyContactActive,
  setEmergencyScenarioActive,
  startEmergencyDrill,
  submitEmergencyPlan,
  transitionEmergencyActivation,
  updateEmergencyActivationSituation,
  updateEmergencyImprovement,
  updateEmergencyPlan,
} from "@/features/emergency/actions";
import { RuntimeFormFields } from "@/features/forms/runtime-form-fields";
import {
  emergencyActivationNextStatuses,
  emergencyImprovementNextStatuses,
} from "@/modules/emergency/emergency-lifecycle";
import {
  EmergencyActivationStatus,
  EmergencyContactType,
  EmergencyDrillRating,
  EmergencyDrillStatus,
  EmergencyDrillType,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
  EmergencyPlanType,
  EmergencyScenarioCategory,
  RiskLevel,
} from "@prisma/client";
import { useActionState, type ReactNode } from "react";

type Option = { id: string; name: string };
type SiteOption = Option;
type DepartmentOption = Option & { siteId: string; siteName: string };
type Forms = Parameters<typeof RuntimeFormFields>[0]["forms"];

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50";
const button =
  "mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50";
const card = "rounded-3xl border border-white/10 bg-white/[.04] p-6";

type EmergencyPlanValues = {
  id: string;
  reference: string;
  title: string;
  type: EmergencyPlanType;
  siteId: string;
  departmentId: string | null;
  ownerId: string;
  scope: string;
  purpose: string | null;
  hazardProfile: string;
  commandStructure: string;
  communicationProcedure: string;
  evacuationProcedure: string;
  shelterProcedure: string | null;
  accountabilityProcedure: string;
  medicalProcedure: string | null;
  externalCoordination: string | null;
  recoveryCriteria: string;
  reviewDueAt: string;
};

export function EmergencyPlanForm({
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
  plan?: EmergencyPlanValues;
}) {
  const [state, action, pending] = useActionState(
    plan ? updateEmergencyPlan : createEmergencyPlan,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[.04] p-7"
    >
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <section>
        <h2 className="text-xl font-semibold">Plan identity and ownership</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field
            name="reference"
            label="Plan reference"
            defaultValue={plan?.reference}
            readOnly={Boolean(plan)}
            required
          />
          <Field
            name="title"
            label="Plan title"
            defaultValue={plan?.title}
            required
          />
          <Select
            name="type"
            label="Plan type"
            values={Object.values(EmergencyPlanType)}
            defaultValue={plan?.type}
            required
          />
          <SiteSelect
            name="siteId"
            label="Site"
            sites={sites}
            defaultValue={plan?.siteId}
            required
          />
          <DepartmentSelect
            departments={departments}
            defaultValue={plan?.departmentId ?? undefined}
          />
          <UserSelect
            name="ownerId"
            label="Plan owner"
            users={users}
            defaultValue={plan?.ownerId}
            required
          />
          <Field
            name="reviewDueAt"
            label="Next formal review"
            type="date"
            defaultValue={plan?.reviewDueAt}
            required
          />
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Controlled response framework</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Area name="scope" label="Scope" defaultValue={plan?.scope} required />
          <Area name="purpose" label="Purpose" defaultValue={plan?.purpose} />
          <Area
            name="hazardProfile"
            label="Hazard profile and credible emergencies"
            defaultValue={plan?.hazardProfile}
            required
          />
          <Area
            name="commandStructure"
            label="Incident command structure"
            defaultValue={plan?.commandStructure}
            required
          />
          <Area
            name="communicationProcedure"
            label="Alarm and communication procedure"
            defaultValue={plan?.communicationProcedure}
            required
          />
          <Area
            name="evacuationProcedure"
            label="Evacuation procedure"
            defaultValue={plan?.evacuationProcedure}
            required
          />
          <Area
            name="shelterProcedure"
            label="Shelter-in-place procedure"
            defaultValue={plan?.shelterProcedure}
          />
          <Area
            name="accountabilityProcedure"
            label="Personnel accountability procedure"
            defaultValue={plan?.accountabilityProcedure}
            required
          />
          <Area
            name="medicalProcedure"
            label="Medical and first-aid procedure"
            defaultValue={plan?.medicalProcedure}
          />
          <Area
            name="externalCoordination"
            label="External agency and mutual-aid coordination"
            defaultValue={plan?.externalCoordination}
          />
          <Area
            name="recoveryCriteria"
            label="Stand-down and recovery criteria"
            defaultValue={plan?.recoveryCriteria}
            required
          />
        </div>
      </section>
      {!plan ? <RuntimeFormFields forms={forms} /> : null}
      <Feedback state={state} />
      <button disabled={pending} className={button}>
        {pending
          ? "Saving…"
          : plan
            ? "Update Emergency Plan"
            : "Create Emergency Plan"}
      </button>
    </form>
  );
}

export function EmergencyScenarioForm({ planId }: { planId: string }) {
  return (
    <ManagedForm
      action={addEmergencyScenario}
      title="Add emergency scenario"
      submitLabel="Add Scenario"
    >
      <input type="hidden" name="planId" value={planId} />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Select
          name="category"
          label="Category"
          values={Object.values(EmergencyScenarioCategory)}
          required
        />
        <Select
          name="riskLevel"
          label="Credible severity"
          values={Object.values(RiskLevel)}
          defaultValue={RiskLevel.HIGH}
          required
        />
        <Field name="sequence" label="Display sequence" type="number" defaultValue={0} />
        <Field name="title" label="Scenario title" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Area name="triggerCriteria" label="Activation triggers" required />
        <Area name="immediateActions" label="Immediate actions" required />
        <Area name="protectiveActions" label="Protective actions" required />
        <Area name="evacuationAreas" label="Evacuation areas" />
        <Area name="musterPoints" label="Muster points" />
        <Area name="shutdownSteps" label="Safe shutdown steps" />
        <Area name="requiredEquipment" label="Required emergency equipment" />
        <Area name="specialAssistance" label="Special-assistance arrangements" />
        <Area name="externalAgencies" label="External agencies" />
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-300">
        <Check name="evacuationRequired" label="Evacuation required" />
        <Check name="shelterInPlace" label="Shelter in place may be required" />
      </div>
    </ManagedForm>
  );
}

export function EmergencyScenarioAvailabilityForm({
  planId,
  scenarioId,
  active,
}: {
  planId: string;
  scenarioId: string;
  active: boolean;
}) {
  return (
    <ManagedForm
      action={setEmergencyScenarioActive}
      title="Scenario availability"
      submitLabel={active ? "Disable Scenario" : "Enable Scenario"}
      compact
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="scenarioId" value={scenarioId} />
      <input type="hidden" name="isActive" value={String(!active)} />
      <Field name="reason" label="Reason" required />
    </ManagedForm>
  );
}

export function EmergencyContactForm({ planId }: { planId: string }) {
  return (
    <ManagedForm
      action={addEmergencyContact}
      title="Add emergency contact"
      submitLabel="Add Contact"
    >
      <input type="hidden" name="planId" value={planId} />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Select
          name="type"
          label="Contact type"
          values={Object.values(EmergencyContactType)}
          required
        />
        <Field name="name" label="Contact name" required />
        <Field name="role" label="Role / capability" />
        <Field name="organizationName" label="Organization" />
        <Field name="phone" label="Primary phone" type="tel" required />
        <Field name="alternatePhone" label="Alternate phone" type="tel" />
        <Field name="email" label="Email" type="email" />
        <Field name="availability" label="Availability / coverage" />
        <Field name="priority" label="Call priority" type="number" defaultValue={0} />
      </div>
    </ManagedForm>
  );
}

export function EmergencyContactAvailabilityForm({
  planId,
  contactId,
  active,
}: {
  planId: string;
  contactId: string;
  active: boolean;
}) {
  return (
    <ManagedForm
      action={setEmergencyContactActive}
      title="Contact availability"
      submitLabel={active ? "Disable Contact" : "Enable Contact"}
      compact
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="isActive" value={String(!active)} />
      <Field name="reason" label="Reason" required />
    </ManagedForm>
  );
}

export function EmergencyPlanGovernanceForm({
  planId,
  status,
}: {
  planId: string;
  status: EmergencyPlanStatus;
}) {
  if (
    status === EmergencyPlanStatus.DRAFT ||
    status === EmergencyPlanStatus.REJECTED
  ) {
    return (
      <ManagedForm
        action={submitEmergencyPlan}
        title="Submit controlled plan"
        submitLabel="Submit for Approval"
      >
        <input type="hidden" name="planId" value={planId} />
        <Area
          name="submissionNotes"
          label="Submission scope, changes, and validation performed"
          required
        />
      </ManagedForm>
    );
  }
  if (status === EmergencyPlanStatus.IN_REVIEW) {
    return (
      <ManagedForm
        action={decideEmergencyPlan}
        title="Plan approval decision"
        submitLabel="Record Decision"
      >
        <input type="hidden" name="planId" value={planId} />
        <Select
          name="decision"
          label="Decision"
          values={[EmergencyPlanStatus.ACTIVE, EmergencyPlanStatus.REJECTED]}
          required
        />
        <Area
          name="reviewNotes"
          label="Review rationale and residual concerns"
          required
        />
      </ManagedForm>
    );
  }
  if (status === EmergencyPlanStatus.ACTIVE) {
    return (
      <ManagedForm
        action={createEmergencyPlanRevision}
        title="Controlled plan revision"
        submitLabel="Start New Version"
      >
        <input type="hidden" name="planId" value={planId} />
        <Area name="reason" label="Revision reason and intended change" required />
      </ManagedForm>
    );
  }
  return null;
}

export function EmergencyDrillScheduleForm({
  plans,
  users,
}: {
  plans: Array<Option & { scenarios: Option[] }>;
  users: Option[];
}) {
  return (
    <ManagedForm
      action={scheduleEmergencyDrill}
      title="Schedule emergency exercise"
      submitLabel="Schedule Drill"
    >
      <p className="mt-2 text-sm text-slate-400">
        Scenario selection is revalidated against the selected active plan on
        submission.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          Active plan <span className="text-red-300">*</span>
          <select name="planId" required className={input}>
            <option value="">Select</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Scenario
          <select name="scenarioId" className={input}>
            <option value="">General / multi-scenario</option>
            {plans.flatMap((plan) =>
              plan.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {plan.name} — {scenario.name}
                </option>
              )),
            )}
          </select>
        </label>
        <UserSelect name="leadId" label="Drill lead" users={users} required />
        <Field name="reference" label="Drill reference" required />
        <Select
          name="type"
          label="Exercise type"
          values={Object.values(EmergencyDrillType)}
          required
        />
        <Field
          name="scheduledAt"
          label="Scheduled date and time"
          type="datetime-local"
          required
        />
        <Field
          name="expectedParticipants"
          label="Expected participants"
          type="number"
          defaultValue={1}
          required
        />
      </div>
      <Area name="objectives" label="Exercise objectives" required />
      <Area name="scope" label="Exercise scope" />
    </ManagedForm>
  );
}

export function EmergencyDrillLifecycleForms({
  drillId,
  status,
}: {
  drillId: string;
  status: EmergencyDrillStatus;
}) {
  if (status === EmergencyDrillStatus.PLANNED) {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <ManagedForm
          action={startEmergencyDrill}
          title="Start exercise"
          submitLabel="Start Drill"
        >
          <input type="hidden" name="drillId" value={drillId} />
          <Field name="note" label="Start note" required />
        </ManagedForm>
        <DrillCancellationForm drillId={drillId} />
      </div>
    );
  }
  if (status === EmergencyDrillStatus.IN_PROGRESS) {
    return (
      <div className="space-y-5">
        <ManagedForm
          action={completeEmergencyDrill}
          title="Complete exercise and after-action review"
          submitLabel="Complete Drill"
        >
          <input type="hidden" name="drillId" value={drillId} />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              name="actualParticipants"
              label="Actual participants"
              type="number"
              required
            />
            <Select
              name="rating"
              label="Effectiveness rating"
              values={Object.values(EmergencyDrillRating)}
              required
            />
            <Field name="notificationMethod" label="Notification method tested" />
            <Field
              name="alarmActivationSeconds"
              label="Alarm activation (seconds)"
              type="number"
            />
            <Field
              name="evacuationSeconds"
              label="Evacuation (seconds)"
              type="number"
            />
            <Field
              name="accountabilitySeconds"
              label="Accountability (seconds)"
              type="number"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Area name="strengths" label="Demonstrated strengths" required />
            <Area name="gaps" label="Gaps or no-gap rationale" required />
            <Area name="observerNotes" label="Observer notes" />
            <Area
              name="afterActionSummary"
              label="After-action summary"
              required
            />
          </div>
        </ManagedForm>
        <DrillCancellationForm drillId={drillId} />
      </div>
    );
  }
  return null;
}

function DrillCancellationForm({ drillId }: { drillId: string }) {
  return (
    <ManagedForm
      action={cancelEmergencyDrill}
      title="Cancel exercise"
      submitLabel="Cancel Drill"
    >
      <input type="hidden" name="drillId" value={drillId} />
      <Area name="reason" label="Cancellation rationale" required />
    </ManagedForm>
  );
}

export function EmergencyActivationForm({
  plans,
  users,
}: {
  plans: Array<Option & { scenarios: Option[] }>;
  users: Option[];
}) {
  return (
    <ManagedForm
      action={activateEmergencyResponse}
      title="Activate emergency response record"
      submitLabel="Activate Response Record"
    >
      <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-sm leading-6 text-amber-100">
        Senzilytics is a governance and recordkeeping system. Use approved site
        alarms, emergency services, radios, and local response channels for
        immediate life-safety instructions.
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          Active plan <span className="text-red-300">*</span>
          <select name="planId" required className={input}>
            <option value="">Select</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Scenario
          <select name="scenarioId" className={input}>
            <option value="">General / other scenario</option>
            {plans.flatMap((plan) =>
              plan.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {plan.name} — {scenario.name}
                </option>
              )),
            )}
          </select>
        </label>
        <UserSelect
          name="incidentCommanderId"
          label="Incident commander"
          users={users}
          required
        />
        <Field name="reference" label="Activation reference" required />
        <Select
          name="severity"
          label="Severity"
          values={Object.values(RiskLevel)}
          defaultValue={RiskLevel.HIGH}
          required
        />
        <Field name="location" label="Exact location" required />
        <Field
          name="declaredAt"
          label="Declaration time"
          type="datetime-local"
          required
        />
        <Field
          name="afterActionDueAt"
          label="After-action review due"
          type="date"
          required
        />
        <Field
          name="peopleAtRisk"
          label="People potentially at risk"
          type="number"
          defaultValue={0}
        />
        <Field
          name="injuriesReported"
          label="Injuries reported"
          type="number"
          defaultValue={0}
        />
        <Field
          name="missingPersons"
          label="Persons unaccounted for"
          type="number"
          defaultValue={0}
        />
      </div>
      <Area name="summary" label="Verified situation summary" required />
      <Area
        name="notificationMethod"
        label="Alarms and response channels activated"
        required
      />
      <Area
        name="protectiveActions"
        label="Protective actions initiated"
        required
      />
      <Area
        name="externalAgenciesNotified"
        label="External agencies notified"
      />
    </ManagedForm>
  );
}

export function EmergencySituationForm({
  activation,
}: {
  activation: {
    id: string;
    summary: string;
    notificationMethod: string;
    protectiveActions: string;
    externalAgenciesNotified: string | null;
    peopleAtRisk: number;
    injuriesReported: number;
    missingPersons: number;
  };
}) {
  return (
    <ManagedForm
      action={updateEmergencyActivationSituation}
      title="Update verified situation"
      submitLabel="Update Situation"
    >
      <input type="hidden" name="activationId" value={activation.id} />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field
          name="peopleAtRisk"
          label="People potentially at risk"
          type="number"
          defaultValue={activation.peopleAtRisk}
        />
        <Field
          name="injuriesReported"
          label="Injuries reported"
          type="number"
          defaultValue={activation.injuriesReported}
        />
        <Field
          name="missingPersons"
          label="Persons unaccounted for"
          type="number"
          defaultValue={activation.missingPersons}
        />
      </div>
      <Area
        name="summary"
        label="Verified situation summary"
        defaultValue={activation.summary}
        required
      />
      <Area
        name="notificationMethod"
        label="Alarms and response channels activated"
        defaultValue={activation.notificationMethod}
        required
      />
      <Area
        name="protectiveActions"
        label="Protective actions"
        defaultValue={activation.protectiveActions}
        required
      />
      <Area
        name="externalAgenciesNotified"
        label="External agencies notified"
        defaultValue={activation.externalAgenciesNotified}
      />
    </ManagedForm>
  );
}

export function EmergencyActivationTransitionForm({
  activationId,
  status,
}: {
  activationId: string;
  status: EmergencyActivationStatus;
}) {
  const next = emergencyActivationNextStatuses(status);
  if (!next.length) return null;
  return (
    <ManagedForm
      action={transitionEmergencyActivation}
      title="Response lifecycle"
      submitLabel="Apply Status"
    >
      <input type="hidden" name="activationId" value={activationId} />
      <p className="mt-2 text-sm text-slate-400">
        Current state: {pretty(status)}
      </p>
      <Select name="status" label="Next state" values={next} required />
      <Area name="note" label="Verified transition rationale" required />
      {next.includes(EmergencyActivationStatus.REVIEWED) ? (
        <>
          <Area
            name="afterActionSummary"
            label="After-action summary"
            required
          />
          <Area name="lessonsLearned" label="Lessons learned" required />
        </>
      ) : null}
    </ManagedForm>
  );
}

export function EmergencyImprovementForm({
  planId,
  users,
  drillId,
  activationId,
}: {
  planId: string;
  users: Option[];
  drillId?: string;
  activationId?: string;
}) {
  return (
    <ManagedForm
      action={createEmergencyImprovement}
      title="Create after-action improvement"
      submitLabel="Create Improvement"
    >
      <input type="hidden" name="planId" value={planId} />
      {drillId ? <input type="hidden" name="drillId" value={drillId} /> : null}
      {activationId ? (
        <input type="hidden" name="activationId" value={activationId} />
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field name="title" label="Improvement title" required />
        <UserSelect name="ownerId" label="Owner" users={users} required />
        <Select
          name="priority"
          label="Priority"
          values={Object.values(RiskLevel)}
          defaultValue={RiskLevel.HIGH}
          required
        />
        <Field name="dueAt" label="Due date" type="date" required />
      </div>
      <Area
        name="description"
        label="Gap, required outcome, and acceptance criteria"
        required
      />
    </ManagedForm>
  );
}

export function EmergencyImprovementLifecycleForm({
  improvement,
  canManage,
}: {
  improvement: {
    id: string;
    planId: string;
    drillId: string | null;
    activationId: string | null;
    status: EmergencyImprovementStatus;
  };
  canManage: boolean;
}) {
  const next = emergencyImprovementNextStatuses(improvement.status).filter(
    (status) => status !== EmergencyImprovementStatus.VERIFIED || canManage,
  );
  if (!next.length) return null;
  return (
    <ManagedForm
      action={updateEmergencyImprovement}
      title="Update improvement"
      submitLabel="Update Improvement"
      compact
    >
      <input type="hidden" name="improvementId" value={improvement.id} />
      <input type="hidden" name="planId" value={improvement.planId} />
      {improvement.drillId ? (
        <input type="hidden" name="drillId" value={improvement.drillId} />
      ) : null}
      {improvement.activationId ? (
        <input
          type="hidden"
          name="activationId"
          value={improvement.activationId}
        />
      ) : null}
      <Select name="status" label="Next state" values={next} required />
      <Area name="completionEvidence" label="Completion evidence" />
      {canManage ? (
        <Area name="verificationNotes" label="Verification notes" />
      ) : null}
    </ManagedForm>
  );
}

export function EmergencyImprovementCapaForm({
  improvement,
  users,
}: {
  improvement: {
    id: string;
    planId: string;
    drillId: string | null;
    activationId: string | null;
    title: string;
    description: string;
  };
  users: Option[];
}) {
  return (
    <ManagedForm
      action={createCapaFromEmergencyImprovement}
      title="Escalate to corrective action"
      submitLabel="Create Linked CAPA"
      compact
    >
      <input type="hidden" name="improvementId" value={improvement.id} />
      <input type="hidden" name="planId" value={improvement.planId} />
      {improvement.drillId ? (
        <input type="hidden" name="drillId" value={improvement.drillId} />
      ) : null}
      {improvement.activationId ? (
        <input
          type="hidden"
          name="activationId"
          value={improvement.activationId}
        />
      ) : null}
      <Field
        name="title"
        label="Corrective-action title"
        defaultValue={improvement.title}
        required
      />
      <UserSelect name="assignedToId" label="CAPA owner" users={users} required />
      <Field name="dueDate" label="CAPA due date" type="date" required />
      <Area
        name="description"
        label="Corrective-action description"
        defaultValue={improvement.description}
      />
    </ManagedForm>
  );
}

function ManagedForm({
  action,
  title,
  submitLabel,
  children,
  compact = false,
}: {
  action: (
    state: FormActionState,
    data: FormData,
  ) => Promise<FormActionState>;
  title: string;
  submitLabel: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState,
  );
  return (
    <form action={formAction} className={compact ? "mt-4" : card}>
      <h2 className={compact ? "text-sm font-semibold" : "text-xl font-semibold"}>
        {title}
      </h2>
      {children}
      <button disabled={pending} className={button}>
        {pending ? "Saving…" : submitLabel}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Feedback({ state }: { state: FormActionState }) {
  if (state.status === "IDLE") return null;
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      aria-live="polite"
      className={`mt-4 rounded-xl border p-3 text-sm ${
        state.status === "ERROR"
          ? "border-red-400/20 bg-red-400/10 text-red-200"
          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      }`}
    >
      {state.message}
    </p>
  );
}

function Field({
  name,
  label,
  type = "text",
  required: requiredValue,
  defaultValue,
  readOnly,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  readOnly?: boolean;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      {requiredValue ? <span className="text-red-300"> *</span> : null}
      <input
        name={name}
        type={type}
        required={requiredValue}
        defaultValue={defaultValue ?? ""}
        readOnly={readOnly}
        min={type === "number" ? 0 : undefined}
        className={input}
      />
    </label>
  );
}

function Area({
  name,
  label,
  required: requiredValue,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string | null;
}) {
  return (
    <label className="mt-4 block text-sm text-slate-300">
      {label}
      {requiredValue ? <span className="text-red-300"> *</span> : null}
      <textarea
        name={name}
        required={requiredValue}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className={input}
      />
    </label>
  );
}

function Select({
  name,
  label,
  values,
  required: requiredValue,
  defaultValue,
}: {
  name: string;
  label: string;
  values: readonly string[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      {requiredValue ? <span className="text-red-300"> *</span> : null}
      <select
        name={name}
        required={requiredValue}
        defaultValue={defaultValue ?? ""}
        className={input}
      >
        {!defaultValue ? <option value="">Select</option> : null}
        {values.map((item) => (
          <option key={item} value={item}>
            {pretty(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserSelect({
  name,
  label,
  users,
  required: requiredValue,
  defaultValue,
}: {
  name: string;
  label: string;
  users: Option[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      {requiredValue ? <span className="text-red-300"> *</span> : null}
      <select
        name={name}
        required={requiredValue}
        defaultValue={defaultValue ?? ""}
        className={input}
      >
        <option value="">Select</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SiteSelect({
  name,
  label,
  sites,
  required: requiredValue,
  defaultValue,
}: {
  name: string;
  label: string;
  sites: SiteOption[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      {requiredValue ? <span className="text-red-300"> *</span> : null}
      <select
        name={name}
        required={requiredValue}
        defaultValue={defaultValue ?? ""}
        className={input}
      >
        <option value="">Select</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DepartmentSelect({
  departments,
  defaultValue,
}: {
  departments: DepartmentOption[];
  defaultValue?: string;
}) {
  return (
    <label className="text-sm text-slate-300">
      Department
      <select
        name="departmentId"
        defaultValue={defaultValue ?? ""}
        className={input}
      >
        <option value="">No department / site-wide</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.siteName} — {department.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
