import {
  readWorkflowTriggerConditions,
  workflowConditionOperators,
  type WorkflowTriggerCondition,
} from "@/core/workflow/workflow-automation-rules";
import { Prisma, WorkflowTriggerEvent } from "@prisma/client";

const conditionRows = 5;

const eventDescriptions: Record<WorkflowTriggerEvent, string> = {
  RECORD_CREATED:
    "Start when a supported module creates a new record. Common fields: status, type, riskLevel, siteId, departmentId.",
  STATUS_CHANGED:
    "Start when a supported record changes status. Common fields: previousStatus, status, type, riskLevel, siteId.",
  FORM_SUBMITTED:
    "Start when Form Studio data is submitted. Common fields: formDefinitionId, formVersionId, formStatus, module.",
};

export function WorkflowTriggerSettingsFields({
  triggerEvent = WorkflowTriggerEvent.RECORD_CREATED,
  triggerConditions = null,
}: {
  triggerEvent?: WorkflowTriggerEvent;
  triggerConditions?: Prisma.JsonValue | null;
}) {
  const storedConditions = readWorkflowTriggerConditions(triggerConditions);
  const rows: Array<WorkflowTriggerCondition | undefined> = Array.from(
    { length: conditionRows },
    (_, index) => storedConditions[index],
  );

  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Automation Trigger
          </label>
          <select
            name="triggerEvent"
            defaultValue={triggerEvent}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            {Object.values(WorkflowTriggerEvent).map((event) => (
              <option key={event} value={event}>
                {event.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Available triggers</p>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {Object.entries(eventDescriptions).map(([event, description]) => (
              <p key={event}>
                <span className="text-cyan-300">
                  {event.replaceAll("_", " ")}:
                </span>{" "}
                {description}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div>
          <h3 className="font-medium text-white">Trigger Conditions</h3>
          <p className="mt-1 text-xs text-slate-400">
            Optional. Every completed condition must match. Leave all rows blank
            to start for every event of the selected type.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((condition, index) => (
            <div
              key={index}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]"
            >
              <input
                name="conditionField"
                defaultValue={condition?.field ?? ""}
                placeholder="Field, e.g. riskLevel"
                aria-label={`Trigger condition ${index + 1} field`}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
              <select
                name="conditionOperator"
                defaultValue={condition?.operator ?? ""}
                aria-label={`Trigger condition ${index + 1} operator`}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select operator</option>
                {workflowConditionOperators.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <input
                name="conditionValue"
                defaultValue={condition?.value ?? ""}
                placeholder="Value (comma-separated for IN)"
                aria-label={`Trigger condition ${index + 1} value`}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
