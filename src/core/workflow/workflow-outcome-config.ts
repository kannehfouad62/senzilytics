import {
  NotificationType,
  Prisma,
  RiskCategory,
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  Status,
  UserRole,
  WorkflowOutcomeEvent,
  WorkflowOutcomeType,
} from "@prisma/client";

export type WorkflowOutcomeConfiguration =
  | {
      type: "CREATE_TASK";
      title: string;
      description?: string;
      assignedUserId?: string;
      assignedRole?: UserRole;
      dueInDays: number;
    }
  | {
      type: "CREATE_CORRECTIVE_ACTION";
      title: string;
      description: string;
      assignedUserId: string;
      dueInDays: number;
      riskLevel: RiskLevel;
    }
  | {
      type: "CREATE_RISK_DRAFT";
      title: string;
      description: string;
      ownerId: string;
      siteId?: string;
      departmentId?: string;
      riskCategory: RiskCategory;
      likelihood: RiskLikelihood;
      impact: RiskImpact;
    }
  | {
      type: "CREATE_COMPLIANCE_TASK";
      title: string;
      description?: string;
      ownerId: string;
      siteId: string;
      departmentId?: string;
      dueInDays: number;
      category: string;
    }
  | {
      type: "SEND_NOTIFICATION";
      title: string;
      message: string;
      recipientUserId: string;
      notificationType: NotificationType;
      sendEmail: boolean;
    }
  | {
      type: "UPDATE_SOURCE_STATUS";
      targetStatus: Status;
    }
  | {
      type: "EMIT_WEBHOOK";
      title: string;
      message: string;
    };

const consequentialOutcomeTypes = new Set<WorkflowOutcomeType>([
  WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
  WorkflowOutcomeType.CREATE_RISK_DRAFT,
  WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
  WorkflowOutcomeType.UPDATE_SOURCE_STATUS,
  WorkflowOutcomeType.EMIT_WEBHOOK,
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export const workflowOutcomeTypeDescriptions: Record<
  WorkflowOutcomeType,
  string
> = {
  CREATE_TASK: "Create an assigned task in My Tasks and the unified calendar.",
  CREATE_CORRECTIVE_ACTION:
    "Create a governed CAPA record for the selected tenant user.",
  CREATE_RISK_DRAFT:
    "Create a draft Risk Register recommendation for human assessment.",
  CREATE_COMPLIANCE_TASK:
    "Create a one-time compliance-calendar task and occurrence.",
  SEND_NOTIFICATION:
    "Send an in-app notification and, optionally, a plan-governed email.",
  UPDATE_SOURCE_STATUS:
    "Change the source incident, inspection, or CAPA status after approval.",
  EMIT_WEBHOOK:
    "Emit a signed SYSTEM_EVENT through active Integration Hub endpoints.",
};

export function parseWorkflowOutcomeDefinitionInput(input: {
  name: string;
  event: string;
  outcomeType: string;
  title: string;
  description: string;
  assignedUserId: string;
  assignedRole: string;
  dueInDays: string;
  riskLevel: string;
  riskCategory: string;
  likelihood: string;
  impact: string;
  siteId: string;
  departmentId: string;
  targetStatus: string;
  notificationType: string;
  sendEmail: boolean;
  requiresApproval: boolean;
}) {
  const name = boundedRequired(input.name, "Outcome name", 120);
  const event = enumValue(
    WorkflowOutcomeEvent,
    input.event,
    "Select a valid outcome event.",
  );
  const outcomeType = enumValue(
    WorkflowOutcomeType,
    input.outcomeType,
    "Select a valid outcome type.",
  );
  const configuration = parseConfiguration(outcomeType, {
    title: input.title,
    description: input.description,
    assignedUserId: input.assignedUserId,
    assignedRole: input.assignedRole,
    dueInDays: input.dueInDays,
    riskLevel: input.riskLevel,
    riskCategory: input.riskCategory,
    likelihood: input.likelihood,
    impact: input.impact,
    siteId: input.siteId,
    departmentId: input.departmentId,
    targetStatus: input.targetStatus,
    notificationType: input.notificationType,
    sendEmail: input.sendEmail,
  });

  return {
    name,
    event,
    outcomeType,
    configuration,
    requiresApproval:
      input.requiresApproval || consequentialOutcomeTypes.has(outcomeType),
  };
}

export function readWorkflowOutcomeConfiguration(
  outcomeType: WorkflowOutcomeType,
  value: Prisma.JsonValue,
) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The workflow outcome configuration is invalid.");
  }
  return parseConfiguration(outcomeType, value as Record<string, unknown>);
}

export function workflowOutcomeConfigurationJson(
  configuration: WorkflowOutcomeConfiguration,
): Prisma.InputJsonValue {
  return { ...configuration };
}

export function workflowOutcomeRequiresApproval(type: WorkflowOutcomeType) {
  return consequentialOutcomeTypes.has(type);
}

function parseConfiguration(
  outcomeType: WorkflowOutcomeType,
  input: Record<string, unknown>,
): WorkflowOutcomeConfiguration {
  const title = () =>
    boundedRequired(asText(input.title), "Outcome title", 160);
  const description = () =>
    boundedOptional(asText(input.description), "Description", 2_000);
  const assignedUserId = () =>
    validId(asText(input.assignedUserId), "Select a valid tenant user.");
  const dueInDays = (minimum: number) =>
    boundedInteger(input.dueInDays, minimum, 365, "Due days");

  switch (outcomeType) {
    case WorkflowOutcomeType.CREATE_TASK: {
      const userId = optionalId(asText(input.assignedUserId));
      const roleText = asText(input.assignedRole);
      const assignedRole = roleText
        ? enumValue(UserRole, roleText, "Select a valid assigned role.")
        : undefined;
      if (!userId && !assignedRole) {
        throw new Error("Assign the generated task to a user or role.");
      }
      return compact({
        type: "CREATE_TASK" as const,
        title: title(),
        description: description(),
        assignedUserId: userId,
        assignedRole,
        dueInDays: dueInDays(0),
      });
    }

    case WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION:
      return {
        type: "CREATE_CORRECTIVE_ACTION",
        title: title(),
        description:
          description() ||
          "Corrective action generated from an approved workflow outcome.",
        assignedUserId: assignedUserId(),
        dueInDays: dueInDays(1),
        riskLevel: enumValue(
          RiskLevel,
          asText(input.riskLevel),
          "Select a valid CAPA risk level.",
        ),
      };

    case WorkflowOutcomeType.CREATE_RISK_DRAFT:
      return compact({
        type: "CREATE_RISK_DRAFT" as const,
        title: title(),
        description:
          description() ||
          "Draft risk recommendation generated from a governed workflow.",
        ownerId: assignedUserId(),
        siteId: optionalId(asText(input.siteId)),
        departmentId: optionalId(asText(input.departmentId)),
        riskCategory: enumValue(
          RiskCategory,
          asText(input.riskCategory),
          "Select a valid risk category.",
        ),
        likelihood: enumValue(
          RiskLikelihood,
          asText(input.likelihood),
          "Select a valid likelihood.",
        ),
        impact: enumValue(
          RiskImpact,
          asText(input.impact),
          "Select a valid impact.",
        ),
      });

    case WorkflowOutcomeType.CREATE_COMPLIANCE_TASK:
      return compact({
        type: "CREATE_COMPLIANCE_TASK" as const,
        title: title(),
        description: description(),
        ownerId: assignedUserId(),
        siteId: validId(
          asText(input.siteId),
          "Select a valid compliance-task site.",
        ),
        departmentId: optionalId(asText(input.departmentId)),
        dueInDays: dueInDays(1),
        category: boundedRequired(
          asText(input.riskCategory),
          "Compliance category",
          100,
        ),
      });

    case WorkflowOutcomeType.SEND_NOTIFICATION:
      return {
        type: "SEND_NOTIFICATION",
        title: title(),
        message: boundedRequired(
          asText(input.description),
          "Notification message",
          1_000,
        ),
        recipientUserId: assignedUserId(),
        notificationType: enumValue(
          NotificationType,
          asText(input.notificationType),
          "Select a valid notification type.",
        ),
        sendEmail: Boolean(input.sendEmail),
      };

    case WorkflowOutcomeType.UPDATE_SOURCE_STATUS:
      return {
        type: "UPDATE_SOURCE_STATUS",
        targetStatus: enumValue(
          Status,
          asText(input.targetStatus),
          "Select a valid target status.",
        ),
      };

    case WorkflowOutcomeType.EMIT_WEBHOOK:
      return {
        type: "EMIT_WEBHOOK",
        title: title(),
        message: boundedRequired(
          asText(input.description),
          "Webhook event description",
          1_000,
        ),
      };
  }
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedRequired(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function boundedOptional(value: string, label: string, maximum: number) {
  if (!value.trim()) return undefined;
  return boundedRequired(value, label, maximum);
}

function validId(value: string, error: string) {
  if (!ID_PATTERN.test(value)) throw new Error(error);
  return value;
}

function optionalId(value: string) {
  return value ? validId(value, "A configured resource identifier is invalid.") : undefined;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
) {
  const parsed =
    typeof value === "number" ? value : Number(asText(value));
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${label} must be a whole number between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function enumValue<T extends Record<string, string>>(
  values: T,
  value: string,
  error: string,
): T[keyof T] {
  if (!Object.values(values).includes(value)) throw new Error(error);
  return value as T[keyof T];
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
