"use client";

import { initialFormActionState } from "@/core/actions/action-state";
import { createWorkflowOutcomeDefinitionWithFeedback } from "@/core/workflow/workflow-outcome.actions";
import { workflowOutcomeTypeDescriptions } from "@/core/workflow/workflow-outcome-config";
import {
  NotificationType,
  RiskCategory,
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  Status,
  UserRole,
  WorkflowOutcomeEvent,
  WorkflowOutcomeType,
} from "@prisma/client";
import { useActionState, useState } from "react";

type StepOption = {
  id: string;
  sequence: number;
  name: string;
};

type UserOption = {
  id: string;
  name: string;
  role: UserRole;
};

type SiteOption = {
  id: string;
  name: string;
  departments: Array<{ id: string; name: string }>;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

const forcedApprovalTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
  WorkflowOutcomeType.CREATE_RISK_DRAFT,
  WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
  WorkflowOutcomeType.UPDATE_SOURCE_STATUS,
  WorkflowOutcomeType.EMIT_WEBHOOK,
]);
const userOutcomeTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_TASK,
  WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
  WorkflowOutcomeType.CREATE_RISK_DRAFT,
  WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
  WorkflowOutcomeType.SEND_NOTIFICATION,
]);
const dueDateOutcomeTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_TASK,
  WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
  WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
]);
const siteOutcomeTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_RISK_DRAFT,
  WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
]);
const descriptionRequiredTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
  WorkflowOutcomeType.CREATE_RISK_DRAFT,
  WorkflowOutcomeType.SEND_NOTIFICATION,
  WorkflowOutcomeType.EMIT_WEBHOOK,
]);

export function WorkflowOutcomeDefinitionForm({
  workflowId,
  steps,
  users,
  sites,
}: {
  workflowId: string;
  steps: StepOption[];
  users: UserOption[];
  sites: SiteOption[];
}) {
  const [state, action, pending] = useActionState(
    createWorkflowOutcomeDefinitionWithFeedback,
    initialFormActionState,
  );
  const [outcomeType, setOutcomeType] = useState<WorkflowOutcomeType>(
    WorkflowOutcomeType.CREATE_TASK,
  );
  const [siteId, setSiteId] = useState("");
  const selectedSite = sites.find((site) => site.id === siteId);
  const forcedApproval = forcedApprovalTypes.has(outcomeType);
  const needsTitle =
    outcomeType !== WorkflowOutcomeType.UPDATE_SOURCE_STATUS;
  const needsUser = userOutcomeTypes.has(outcomeType);
  const needsDueDays = dueDateOutcomeTypes.has(outcomeType);
  const needsSite = siteOutcomeTypes.has(outcomeType);

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="workflowId" value={workflowId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Outcome name">
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Create escalation CAPA"
            className={inputClass}
          />
        </Field>
        <Field label="Workflow step">
          <select name="stepId" required className={inputClass}>
            <option value="">Select step</option>
            {steps.map((step) => (
              <option key={step.id} value={step.id}>
                {step.sequence}. {step.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Run when">
          <select
            name="event"
            defaultValue={WorkflowOutcomeEvent.STEP_APPROVED}
            className={inputClass}
          >
            {Object.values(WorkflowOutcomeEvent).map((event) => (
              <option key={event} value={event}>
                {event.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action">
          <select
            name="outcomeType"
            value={outcomeType}
            onChange={(event) =>
              setOutcomeType(event.target.value as WorkflowOutcomeType)
            }
            className={inputClass}
          >
            {Object.values(WorkflowOutcomeType).map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3 text-sm text-slate-300">
        {workflowOutcomeTypeDescriptions[outcomeType]}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {needsTitle && (
          <Field label="Generated title">
            <input
              name="title"
              required
              maxLength={160}
              className={inputClass}
            />
          </Field>
        )}

        {needsTitle && (
          <Field
            label={
              outcomeType === WorkflowOutcomeType.SEND_NOTIFICATION
                ? "Notification message"
                : outcomeType === WorkflowOutcomeType.EMIT_WEBHOOK
                  ? "Webhook event description"
                  : "Description"
            }
          >
            <textarea
              name="description"
              required={descriptionRequiredTypes.has(outcomeType)}
              rows={3}
              maxLength={2000}
              className={inputClass}
            />
          </Field>
        )}

        {needsUser && (
          <Field
            label={
              outcomeType === WorkflowOutcomeType.SEND_NOTIFICATION
                ? "Recipient"
                : outcomeType === WorkflowOutcomeType.CREATE_RISK_DRAFT ||
                    outcomeType === WorkflowOutcomeType.CREATE_COMPLIANCE_TASK
                  ? "Owner"
                  : "Assigned user"
            }
          >
            <select
              name="assignedUserId"
              required={outcomeType !== WorkflowOutcomeType.CREATE_TASK}
              className={inputClass}
            >
              <option value="">
                {outcomeType === WorkflowOutcomeType.CREATE_TASK
                  ? "Use assigned role"
                  : "Select user"}
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {user.role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        )}

        {outcomeType === WorkflowOutcomeType.CREATE_TASK && (
          <Field label="Assigned role">
            <select name="assignedRole" className={inputClass}>
              <option value="">Use assigned user</option>
              {Object.values(UserRole).map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        )}

        {needsDueDays && (
          <Field label="Due in days">
            <input
              name="dueInDays"
              type="number"
              min={
                outcomeType === WorkflowOutcomeType.CREATE_TASK ? 0 : 1
              }
              max={365}
              defaultValue={
                outcomeType === WorkflowOutcomeType.CREATE_TASK ? 0 : 30
              }
              required
              className={inputClass}
            />
          </Field>
        )}

        {outcomeType === WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION && (
          <Field label="CAPA risk level">
            <select
              name="riskLevel"
              defaultValue={RiskLevel.MEDIUM}
              className={inputClass}
            >
              {Object.values(RiskLevel).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </Field>
        )}

        {needsSite && (
          <>
            <Field label="Site">
              <select
                name="siteId"
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                required={
                  outcomeType === WorkflowOutcomeType.CREATE_COMPLIANCE_TASK
                }
                className={inputClass}
              >
                <option value="">No site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select name="departmentId" className={inputClass}>
                <option value="">No department</option>
                {selectedSite?.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {outcomeType === WorkflowOutcomeType.CREATE_RISK_DRAFT && (
          <>
            <Field label="Risk category">
              <select
                name="riskCategory"
                defaultValue={RiskCategory.SAFETY}
                className={inputClass}
              >
                {Object.values(RiskCategory).map((category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Likelihood">
              <select
                name="likelihood"
                defaultValue={RiskLikelihood.POSSIBLE}
                className={inputClass}
              >
                {Object.values(RiskLikelihood).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Impact">
              <select
                name="impact"
                defaultValue={RiskImpact.MODERATE}
                className={inputClass}
              >
                {Object.values(RiskImpact).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {outcomeType === WorkflowOutcomeType.CREATE_COMPLIANCE_TASK && (
          <Field label="Compliance category">
            <input
              name="riskCategory"
              required
              defaultValue="Workflow"
              maxLength={100}
              className={inputClass}
            />
          </Field>
        )}

        {outcomeType === WorkflowOutcomeType.SEND_NOTIFICATION && (
          <Field label="Notification type">
            <select
              name="notificationType"
              defaultValue={NotificationType.SYSTEM}
              className={inputClass}
            >
              {Object.values(NotificationType).map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        )}

        {outcomeType === WorkflowOutcomeType.UPDATE_SOURCE_STATUS && (
          <Field label="Target status">
            <select
              name="targetStatus"
              defaultValue={Status.COMPLETED}
              className={inputClass}
            >
              {Object.values(Status).map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            name="requiresApproval"
            defaultChecked={forcedApproval}
            disabled={forcedApproval}
          />
          Require human approval
        </label>
        {outcomeType === WorkflowOutcomeType.SEND_NOTIFICATION && (
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input type="checkbox" name="sendEmail" />
            Also send email when the subscription permits it
          </label>
        )}
        {forcedApproval && (
          <p className="text-xs text-amber-300">
            Human approval is mandatory for this consequential action.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || steps.length === 0}
        className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving outcome…" : "Add Automated Outcome"}
      </button>

      {state.message && (
        <p
          role={state.status === "ERROR" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            state.status === "ERROR"
              ? "border-red-400/20 bg-red-400/10 text-red-300"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      {children}
    </label>
  );
}
