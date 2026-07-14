import {
  getApplicationUrl,
  sendEmail,
} from "@/core/email/email.service";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";

type IncidentReporterConfirmationEmailInput = {
  recipientEmail: string;
  recipientName: string;
  incidentId: string;
  incidentTitle: string;
  incidentDescription: string;
  incidentType: string;
  riskLevel: string;
  status: string;
  siteName: string;
  location?: string | null;
  occurredAt: Date;
};

type HighRiskIncidentAlertEmailInput = {
  recipientEmail: string;
  recipientName: string;
  incidentId: string;
  incidentTitle: string;
  incidentDescription: string;
  incidentType: string;
  riskLevel: string;
  status: string;
  siteName: string;
  location?: string | null;
  occurredAt: Date;
  reportedByName: string;
};

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

function formatEnumValue(value: string) {
  return value.replaceAll("_", " ");
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

export async function sendIncidentReporterConfirmationEmail(
  input: IncidentReporterConfirmationEmailInput
) {
  const applicationUrl = getApplicationUrl();
  const incidentUrl = `${applicationUrl}/incidents/${input.incidentId}`;

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `Incident submitted: ${input.incidentTitle}`,
    html: createSenzilyticsEmailTemplate({
      preheader:
        "Your incident report was submitted successfully in Senzilytics.",
      heading: "Incident report submitted",
      body:
        `Hello ${input.recipientName},\n\n` +
        `Your incident report has been submitted successfully. ` +
        `The incident is now available for review and has entered the applicable workflow process.`,
      actionLabel: "Review Incident",
      actionUrl: incidentUrl,
      details: [
        {
          label: "Incident",
          value: input.incidentTitle,
        },
        {
          label: "Description",
          value: input.incidentDescription,
        },
        {
          label: "Incident type",
          value: formatEnumValue(input.incidentType),
        },
        {
          label: "Risk level",
          value: formatEnumValue(input.riskLevel),
        },
        {
          label: "Status",
          value: formatEnumValue(input.status),
        },
        {
          label: "Site",
          value: input.siteName,
        },
        {
          label: "Location",
          value: input.location || "No location was provided.",
        },
        {
          label: "Occurred",
          value: formatDateTime(input.occurredAt),
        },
      ],
    }),
    text:
      `Hello ${input.recipientName},\n\n` +
      `Your incident report was submitted successfully.\n\n` +
      `Incident: ${input.incidentTitle}\n` +
      `Type: ${formatEnumValue(input.incidentType)}\n` +
      `Risk level: ${formatEnumValue(input.riskLevel)}\n` +
      `Status: ${formatEnumValue(input.status)}\n` +
      `Site: ${input.siteName}\n` +
      `Occurred: ${formatDateTime(input.occurredAt)}\n\n` +
      `Review the incident: ${incidentUrl}`,
  });

  if (!result.success) {
    console.error(
      "Incident reporter confirmation email failed:",
      result.error
    );
  }

  return result;
}

export async function sendHighRiskIncidentAlertEmail(
  input: HighRiskIncidentAlertEmailInput
) {
  const applicationUrl = getApplicationUrl();
  const incidentUrl = `${applicationUrl}/incidents/${input.incidentId}`;
  const isCritical = input.riskLevel === "CRITICAL";

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: `${isCritical ? "CRITICAL" : "HIGH"} incident alert: ${input.incidentTitle}`,
    html: createSenzilyticsEmailTemplate({
      preheader: isCritical
        ? "A critical-risk incident requires immediate review."
        : "A high-risk incident requires prompt review.",
      heading: isCritical
        ? "Critical incident reported"
        : "High-risk incident reported",
      body:
        `Hello ${input.recipientName},\n\n` +
        (isCritical
          ? "A critical-risk incident has been reported and requires immediate assessment, response, and management oversight."
          : "A high-risk incident has been reported and requires prompt assessment and management review."),
      actionLabel: "Review Incident Immediately",
      actionUrl: incidentUrl,
      details: [
        {
          label: "Incident",
          value: input.incidentTitle,
        },
        {
          label: "Description",
          value: input.incidentDescription,
        },
        {
          label: "Incident type",
          value: formatEnumValue(input.incidentType),
        },
        {
          label: "Risk level",
          value: formatEnumValue(input.riskLevel),
        },
        {
          label: "Status",
          value: formatEnumValue(input.status),
        },
        {
          label: "Site",
          value: input.siteName,
        },
        {
          label: "Location",
          value: input.location || "No location was provided.",
        },
        {
          label: "Occurred",
          value: formatDateTime(input.occurredAt),
        },
        {
          label: "Reported by",
          value: input.reportedByName,
        },
      ],
    }),
    text:
      `${isCritical ? "CRITICAL" : "HIGH"} incident alert\n\n` +
      `Incident: ${input.incidentTitle}\n` +
      `Description: ${input.incidentDescription}\n` +
      `Type: ${formatEnumValue(input.incidentType)}\n` +
      `Risk level: ${formatEnumValue(input.riskLevel)}\n` +
      `Status: ${formatEnumValue(input.status)}\n` +
      `Site: ${input.siteName}\n` +
      `Location: ${input.location || "Not provided"}\n` +
      `Occurred: ${formatDateTime(input.occurredAt)}\n` +
      `Reported by: ${input.reportedByName}\n\n` +
      `Review immediately: ${incidentUrl}`,
  });

  if (!result.success) {
    console.error(
      "High-risk incident escalation email failed:",
      result.error
    );
  }

  return result;
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
          value: formatEnumValue(input.riskLevel),
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
          value: formatEnumValue(input.previousStatus),
        },
        {
          label: "New status",
          value: formatEnumValue(input.newStatus),
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
      value: formatEnumValue(input.entityType),
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
          value: formatEnumValue(input.decision),
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
          value: formatEnumValue(input.entityType),
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
          value: formatEnumValue(input.riskLevel),
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