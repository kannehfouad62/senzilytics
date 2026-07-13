import {
  getApplicationUrl,
  sendEmail,
} from "@/core/email/email.service";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";

type CorrectiveActionAssignmentEmailInput = {
  recipientEmail: string;
  recipientName: string;
  actionId: string;
  actionTitle: string;
  actionDescription?: string | null;
  incidentId?: string | null;
  incidentTitle?: string | null;
  dueDate: Date;
  riskLevel: string;
  assignedByName?: string | null;
};

type CorrectiveActionStatusEmailInput = {
  recipientEmail: string;
  recipientName: string;
  actionId: string;
  actionTitle: string;
  incidentId?: string | null;
  previousStatus: string;
  newStatus: string;
  updatedByName?: string | null;
};

type WorkflowAssignmentEmailInput = {
  recipientEmail: string;
  recipientName: string;
  entityType: string;
  entityId: string;
  workflowName: string;
  stepName: string;
  dueAt?: Date | null;
};

type WorkflowDecisionEmailInput = {
  recipientEmail: string;
  recipientName: string;
  entityType: string;
  entityId: string;
  workflowName: string;
  stepName: string;
  decision: string;
  comments?: string | null;
  completedByName?: string | null;
};

type WorkflowSlaEmailInput = {
  recipientEmail: string;
  recipientName: string;
  entityType: string;
  entityId: string;
  workflowName: string;
  stepName: string;
  dueAt: Date;
  notificationKind: "REMINDER" | "OVERDUE";
};

type CorrectiveActionSlaEmailInput = {
  recipientEmail: string;
  recipientName: string;
  actionTitle: string;
  actionDescription?: string | null;
  incidentId?: string | null;
  incidentTitle?: string | null;
  dueDate: Date;
  riskLevel: string;
  notificationKind: "REMINDER" | "OVERDUE";
};

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getEntityUrl(input: {
  entityType: string;
  entityId: string;
}) {
  const applicationUrl = getApplicationUrl();

  switch (input.entityType) {
    case "INCIDENT":
      return `${applicationUrl}/incidents/${input.entityId}`;

    case "CORRECTIVE_ACTION":
      return `${applicationUrl}/actions`;

    case "AUDIT":
      return `${applicationUrl}/audits/${input.entityId}`;

    case "INSPECTION":
      return `${applicationUrl}/inspections/${input.entityId}`;

    default:
      return `${applicationUrl}/tasks`;
  }
}

export async function sendCorrectiveActionAssignmentEmail(
  input: CorrectiveActionAssignmentEmailInput
) {
  const applicationUrl = getApplicationUrl();

  const actionUrl = input.incidentId
    ? `${applicationUrl}/incidents/${input.incidentId}`
    : `${applicationUrl}/actions`;

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `Corrective action assigned: ${input.actionTitle}`,
    html: createSenzilyticsEmailTemplate({
      preheader:
        "A corrective action has been assigned to you in Senzilytics.",
      heading: "New corrective action assigned",
      body:
        `Hello ${input.recipientName},\n\n` +
        `A corrective action has been assigned to you. ` +
        `Please review the requirements and complete it by the stated due date.`,
      actionLabel: "Review Corrective Action",
      actionUrl,
      details: [
        {
          label: "Action",
          value: input.actionTitle,
        },
        {
          label: "Description",
          value:
            input.actionDescription ||
            "No description was provided.",
        },
        {
          label: "Related incident",
          value:
            input.incidentTitle ||
            "No linked incident",
        },
        {
          label: "Risk level",
          value: input.riskLevel.replaceAll("_", " "),
        },
        {
          label: "Due date",
          value: formatDateTime(input.dueDate),
        },
        {
          label: "Assigned by",
          value: input.assignedByName || "System",
        },
      ],
    }),
    text:
      `Hello ${input.recipientName},\n\n` +
      `A corrective action has been assigned to you.\n\n` +
      `Action: ${input.actionTitle}\n` +
      `Risk level: ${input.riskLevel}\n` +
      `Due date: ${formatDateTime(input.dueDate)}\n` +
      `Review it here: ${actionUrl}`,
  });

  if (!result.success) {
    console.error(
      "Corrective-action assignment email failed:",
      result.error
    );
  }

  return result;
}

export async function sendCorrectiveActionStatusEmail(
  input: CorrectiveActionStatusEmailInput
) {
  const applicationUrl = getApplicationUrl();

  const actionUrl = input.incidentId
    ? `${applicationUrl}/incidents/${input.incidentId}`
    : `${applicationUrl}/actions`;

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `Corrective action updated: ${input.actionTitle}`,
    html: createSenzilyticsEmailTemplate({
      preheader:
        "A corrective action status has changed in Senzilytics.",
      heading: "Corrective action status updated",
      body:
        `Hello ${input.recipientName},\n\n` +
        `The status of a corrective action assigned to you has changed.`,
      actionLabel: "Open Corrective Action",
      actionUrl,
      details: [
        {
          label: "Action",
          value: input.actionTitle,
        },
        {
          label: "Previous status",
          value: input.previousStatus.replaceAll("_", " "),
        },
        {
          label: "New status",
          value: input.newStatus.replaceAll("_", " "),
        },
        {
          label: "Updated by",
          value: input.updatedByName || "System",
        },
      ],
    }),
    text:
      `Corrective action updated: ${input.actionTitle}\n` +
      `Previous status: ${input.previousStatus}\n` +
      `New status: ${input.newStatus}\n` +
      `Open: ${actionUrl}`,
  });

  if (!result.success) {
    console.error(
      "Corrective-action status email failed:",
      result.error
    );
  }

  return result;
}

export async function sendWorkflowAssignmentEmail(
  input: WorkflowAssignmentEmailInput
) {
  const entityUrl = getEntityUrl({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  const details = [
    {
      label: "Workflow",
      value: input.workflowName,
    },
    {
      label: "Assigned step",
      value: input.stepName,
    },
    {
      label: "Record type",
      value: input.entityType.replaceAll("_", " "),
    },
  ];

  if (input.dueAt) {
    details.push({
      label: "Due date",
      value: formatDateTime(input.dueAt),
    });
  }

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `Workflow step assigned: ${input.stepName}`,
    html: createSenzilyticsEmailTemplate({
      preheader:
        "A workflow step has been assigned to you in Senzilytics.",
      heading: "Workflow action required",
      body:
        `Hello ${input.recipientName},\n\n` +
        `A workflow step requires your review or approval.`,
      actionLabel: "Review Workflow",
      actionUrl: entityUrl,
      details,
    }),
    text:
      `Workflow action required\n` +
      `Workflow: ${input.workflowName}\n` +
      `Step: ${input.stepName}\n` +
      `Review: ${entityUrl}`,
  });

  if (!result.success) {
    console.error(
      "Workflow-assignment email failed:",
      result.error
    );
  }

  return result;
}

export async function sendWorkflowDecisionEmail(
  input: WorkflowDecisionEmailInput
) {
  const entityUrl = getEntityUrl({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `Workflow step ${input.decision.toLowerCase()}: ${input.stepName}`,
    html: createSenzilyticsEmailTemplate({
      preheader:
        "A workflow decision has been recorded in Senzilytics.",
      heading: "Workflow decision recorded",
      body:
        `Hello ${input.recipientName},\n\n` +
        `A decision has been recorded for a workflow step.`,
      actionLabel: "Open Related Record",
      actionUrl: entityUrl,
      details: [
        {
          label: "Workflow",
          value: input.workflowName,
        },
        {
          label: "Step",
          value: input.stepName,
        },
        {
          label: "Decision",
          value: input.decision.replaceAll("_", " "),
        },
        {
          label: "Completed by",
          value: input.completedByName || "System",
        },
        {
          label: "Comments",
          value: input.comments || "No comments provided.",
        },
      ],
    }),
    text:
      `Workflow decision recorded\n` +
      `Workflow: ${input.workflowName}\n` +
      `Step: ${input.stepName}\n` +
      `Decision: ${input.decision}\n` +
      `Open: ${entityUrl}`,
  });

  if (!result.success) {
    console.error(
      "Workflow-decision email failed:",
      result.error
    );
  }

  return result;
}

export async function sendWorkflowSlaEmail(
  input: WorkflowSlaEmailInput
) {
  const entityUrl = getEntityUrl({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  const isOverdue =
    input.notificationKind === "OVERDUE";

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: isOverdue
      ? `Overdue workflow step: ${input.stepName}`
      : `Workflow step due soon: ${input.stepName}`,
    html: createSenzilyticsEmailTemplate({
      preheader: isOverdue
        ? "A workflow step is overdue in Senzilytics."
        : "A workflow step is due within the next 24 hours.",
      heading: isOverdue
        ? "Workflow step is overdue"
        : "Workflow step is due soon",
      body:
        `Hello ${input.recipientName},\n\n` +
        (isOverdue
          ? "A workflow step assigned to you has passed its due date. Please review and complete it as soon as possible."
          : "A workflow step assigned to you is due within the next 24 hours."),
      actionLabel: "Review Workflow Step",
      actionUrl: entityUrl,
      details: [
        {
          label: "Workflow",
          value: input.workflowName,
        },
        {
          label: "Step",
          value: input.stepName,
        },
        {
          label: "Record type",
          value: input.entityType.replaceAll("_", " "),
        },
        {
          label: "Due date",
          value: formatDateTime(input.dueAt),
        },
        {
          label: "Status",
          value: isOverdue ? "OVERDUE" : "DUE SOON",
        },
      ],
    }),
    text:
      `${isOverdue ? "Workflow step overdue" : "Workflow step due soon"}\n` +
      `Workflow: ${input.workflowName}\n` +
      `Step: ${input.stepName}\n` +
      `Due: ${formatDateTime(input.dueAt)}\n` +
      `Review: ${entityUrl}`,
  });

  if (!result.success) {
    console.error(
      "Workflow SLA email failed:",
      result.error
    );
  }

  return result;
}


export async function sendCorrectiveActionSlaEmail(
  input: CorrectiveActionSlaEmailInput
) {
  const applicationUrl = getApplicationUrl();

  const actionUrl = input.incidentId
    ? `${applicationUrl}/incidents/${input.incidentId}`
    : `${applicationUrl}/actions`;

  const isOverdue =
    input.notificationKind === "OVERDUE";

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: isOverdue
      ? `Overdue corrective action: ${input.actionTitle}`
      : `Corrective action due soon: ${input.actionTitle}`,
    html: createSenzilyticsEmailTemplate({
      preheader: isOverdue
        ? "A corrective action assigned to you is overdue."
        : "A corrective action assigned to you is due soon.",
      heading: isOverdue
        ? "Corrective action is overdue"
        : "Corrective action is due soon",
      body:
        `Hello ${input.recipientName},\n\n` +
        (isOverdue
          ? "A corrective action assigned to you has passed its due date. Please review it and provide an update as soon as possible."
          : "A corrective action assigned to you is due within the next seven days. Please review its progress and complete it before the deadline."),
      actionLabel: "Review Corrective Action",
      actionUrl,
      details: [
        {
          label: "Action",
          value: input.actionTitle,
        },
        {
          label: "Description",
          value:
            input.actionDescription ||
            "No description was provided.",
        },
        {
          label: "Related incident",
          value:
            input.incidentTitle ||
            "No linked incident",
        },
        {
          label: "Risk level",
          value: input.riskLevel.replaceAll("_", " "),
        },
        {
          label: "Due date",
          value: formatDateTime(input.dueDate),
        },
        {
          label: "Status",
          value: isOverdue ? "OVERDUE" : "DUE SOON",
        },
      ],
    }),
    text:
      `${isOverdue ? "Corrective action overdue" : "Corrective action due soon"}\n\n` +
      `Action: ${input.actionTitle}\n` +
      `Risk level: ${input.riskLevel}\n` +
      `Due date: ${formatDateTime(input.dueDate)}\n` +
      `Review: ${actionUrl}`,
  });

  if (!result.success) {
    console.error(
      "Corrective-action SLA email failed:",
      result.error
    );
  }

  return result;
}