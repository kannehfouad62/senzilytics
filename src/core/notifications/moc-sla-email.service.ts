import {
    getApplicationUrl,
    sendTenantNotificationEmail as sendEmail,
  } from "@/core/email/email.service";
  import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
  
  type MocTaskSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
  
    mocId: string;
    mocReference: string;
    mocTitle: string;
  
    taskId: string;
    taskTitle: string;
    taskDescription?: string | null;
    taskType: string;
  
    siteName?: string | null;
    dueDate: Date;
  
    notificationKind:
      | "REMINDER"
      | "OVERDUE";
  };
  
  type MocApprovalSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
  
    mocId: string;
    mocReference: string;
    mocTitle: string;
  
    approvalId: string;
    approvalRole: string;
    requestedAt: Date;
  
    siteName?: string | null;
  };
  
  type TemporaryMocSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
  
    mocId: string;
    mocReference: string;
    mocTitle: string;
  
    siteName?: string | null;
    expirationDate: Date;
  
    notificationKind:
      | "30_DAY"
      | "7_DAY"
      | "EXPIRED";
  
    daysUntilExpiration: number;
  };
  
  type MocPlannedCompletionSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
  
    mocId: string;
    mocReference: string;
    mocTitle: string;
  
    mocStatus: string;
    siteName?: string | null;
    plannedCompletionDate: Date;
  
    notificationKind:
      | "REMINDER"
      | "OVERDUE";
  };
  
  type MocVerificationSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
  
    mocId: string;
    mocReference: string;
    mocTitle: string;
  
    siteName?: string | null;
    plannedCompletionDate: Date;
  };
  
  function formatDateTime(
    value: Date
  ) {
    return value.toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }
  
  function formatDate(
    value: Date
  ) {
    return value.toLocaleDateString(
      "en-US",
      {
        dateStyle: "medium",
      }
    );
  }
  
  function formatEnumValue(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }
  
  function getSiteValue(
    siteName?: string | null
  ) {
    return (
      siteName ||
      "Not specified"
    );
  }
  
  export async function sendMocTaskSlaEmail(
    input: MocTaskSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const mocUrl =
      `${applicationUrl}/moc/${input.mocId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result = await sendEmail({
      to: input.recipientEmail,
  
      subject: isOverdue
        ? `MOC task overdue: ${input.taskTitle}`
        : `MOC task due soon: ${input.taskTitle}`,
  
      html: createSenzilyticsEmailTemplate({
        preheader: isOverdue
          ? "An assigned Management of Change task is overdue."
          : "An assigned Management of Change task is due within seven days.",
  
        heading: isOverdue
          ? "MOC task is overdue"
          : "MOC task is due soon",
  
        body:
          `Hello ${input.recipientName},\n\n` +
          (isOverdue
            ? "An assigned Management of Change task has passed its due date. Please review the task, update its status, and complete the required work."
            : "An assigned Management of Change task is due within the next seven days. Please review the task and complete the required work before the deadline."),
  
        actionLabel:
          "Review MOC Task",
  
        actionUrl:
          mocUrl,
  
        details: [
          {
            label: "MOC",
            value:
              input.mocTitle,
          },
          {
            label: "Reference",
            value:
              input.mocReference,
          },
          {
            label: "Task",
            value:
              input.taskTitle,
          },
          {
            label: "Task type",
            value:
              formatEnumValue(
                input.taskType
              ),
          },
          {
            label: "Description",
            value:
              input.taskDescription ||
              "No description provided.",
          },
          {
            label: "Site",
            value:
              getSiteValue(
                input.siteName
              ),
          },
          {
            label: "Due date",
            value:
              formatDateTime(
                input.dueDate
              ),
          },
          {
            label: "Status",
            value: isOverdue
              ? "OVERDUE"
              : "DUE SOON",
          },
        ],
      }),
  
      text:
        `${isOverdue ? "MOC task overdue" : "MOC task due soon"}\n\n` +
        `MOC: ${input.mocTitle}\n` +
        `Reference: ${input.mocReference}\n` +
        `Task: ${input.taskTitle}\n` +
        `Task type: ${formatEnumValue(input.taskType)}\n` +
        `Site: ${getSiteValue(input.siteName)}\n` +
        `Due date: ${formatDateTime(input.dueDate)}\n\n` +
        `Review: ${mocUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `MOC task SLA email failed for task ${input.taskId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendMocApprovalSlaEmail(
    input: MocApprovalSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const mocUrl =
      `${applicationUrl}/moc/${input.mocId}`;
  
    const formattedRole =
      formatEnumValue(
        input.approvalRole
      );
  
    const result = await sendEmail({
      to: input.recipientEmail,
  
      subject:
        `MOC approval pending: ${input.mocReference}`,
  
      html: createSenzilyticsEmailTemplate({
        preheader:
          "A Management of Change approval remains pending.",
  
        heading:
          "MOC approval is pending",
  
        body:
          `Hello ${input.recipientName},\n\n` +
          `The ${formattedRole} approval assigned to you remains pending. Please review the Management of Change request and record your decision.`,
  
        actionLabel:
          "Review MOC Approval",
  
        actionUrl:
          mocUrl,
  
        details: [
          {
            label: "MOC",
            value:
              input.mocTitle,
          },
          {
            label: "Reference",
            value:
              input.mocReference,
          },
          {
            label: "Approval role",
            value:
              formattedRole,
          },
          {
            label: "Site",
            value:
              getSiteValue(
                input.siteName
              ),
          },
          {
            label: "Requested",
            value:
              formatDateTime(
                input.requestedAt
              ),
          },
          {
            label: "Status",
            value:
              "PENDING",
          },
        ],
      }),
  
      text:
        `MOC approval pending\n\n` +
        `MOC: ${input.mocTitle}\n` +
        `Reference: ${input.mocReference}\n` +
        `Approval role: ${formattedRole}\n` +
        `Site: ${getSiteValue(input.siteName)}\n` +
        `Requested: ${formatDateTime(input.requestedAt)}\n\n` +
        `Review: ${mocUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `MOC approval SLA email failed for approval ${input.approvalId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendTemporaryMocSlaEmail(
    input: TemporaryMocSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const mocUrl =
      `${applicationUrl}/moc/${input.mocId}`;
  
    const isExpired =
      input.notificationKind ===
      "EXPIRED";
  
    const isSevenDay =
      input.notificationKind ===
      "7_DAY";
  
    const subject = isExpired
      ? `Temporary MOC expired: ${input.mocReference}`
      : isSevenDay
        ? `Temporary MOC expires soon: ${input.mocReference}`
        : `Temporary MOC expiration approaching: ${input.mocReference}`;
  
    const heading = isExpired
      ? "Temporary MOC has expired"
      : isSevenDay
        ? "Temporary MOC expires soon"
        : "Temporary MOC expiration approaching";
  
    const preheader = isExpired
      ? "A temporary Management of Change record has expired."
      : isSevenDay
        ? "A temporary Management of Change record expires within seven days."
        : "A temporary Management of Change record expires within 30 days.";
  
    const body = isExpired
      ? `Hello ${input.recipientName},\n\nThe temporary Management of Change record below has passed its expiration date. Review whether the temporary change should be removed, extended through an authorized review, converted to a permanent change, or otherwise formally resolved.`
      : `Hello ${input.recipientName},\n\nThe temporary Management of Change record below is approaching its expiration date. Review the change and determine whether it should be removed, extended through an authorized review, converted to a permanent change, or closed.`;
  
    const statusValue =
      isExpired
        ? "EXPIRED"
        : `${input.daysUntilExpiration} DAY(S) REMAINING`;
  
    const result = await sendEmail({
      to: input.recipientEmail,
  
      subject,
  
      html: createSenzilyticsEmailTemplate({
        preheader,
        heading,
        body,
  
        actionLabel:
          "Review Temporary MOC",
  
        actionUrl:
          mocUrl,
  
        details: [
          {
            label: "MOC",
            value:
              input.mocTitle,
          },
          {
            label: "Reference",
            value:
              input.mocReference,
          },
          {
            label: "Site",
            value:
              getSiteValue(
                input.siteName
              ),
          },
          {
            label: "Expiration date",
            value:
              formatDateTime(
                input.expirationDate
              ),
          },
          {
            label: "Expiration status",
            value:
              statusValue,
          },
        ],
      }),
  
      text:
        `${heading}\n\n` +
        `MOC: ${input.mocTitle}\n` +
        `Reference: ${input.mocReference}\n` +
        `Site: ${getSiteValue(input.siteName)}\n` +
        `Expiration date: ${formatDateTime(input.expirationDate)}\n` +
        `Status: ${statusValue}\n\n` +
        `Review: ${mocUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `Temporary MOC SLA email failed for MOC ${input.mocId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendMocPlannedCompletionSlaEmail(
    input: MocPlannedCompletionSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const mocUrl =
      `${applicationUrl}/moc/${input.mocId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result = await sendEmail({
      to: input.recipientEmail,
  
      subject: isOverdue
        ? `MOC planned completion overdue: ${input.mocReference}`
        : `MOC planned completion approaching: ${input.mocReference}`,
  
      html: createSenzilyticsEmailTemplate({
        preheader: isOverdue
          ? "A Management of Change request is past its planned completion date."
          : "A Management of Change request is due for completion within seven days.",
  
        heading: isOverdue
          ? "MOC planned completion is overdue"
          : "MOC planned completion is approaching",
  
        body:
          `Hello ${input.recipientName},\n\n` +
          (isOverdue
            ? "The Management of Change request below has passed its planned completion date and requires review."
            : "The Management of Change request below is due for completion within the next seven days. Please review its progress and remaining requirements."),
  
        actionLabel:
          "Review MOC",
  
        actionUrl:
          mocUrl,
  
        details: [
          {
            label: "MOC",
            value:
              input.mocTitle,
          },
          {
            label: "Reference",
            value:
              input.mocReference,
          },
          {
            label: "Current status",
            value:
              formatEnumValue(
                input.mocStatus
              ),
          },
          {
            label: "Site",
            value:
              getSiteValue(
                input.siteName
              ),
          },
          {
            label: "Planned completion",
            value:
              formatDateTime(
                input.plannedCompletionDate
              ),
          },
          {
            label: "Schedule status",
            value: isOverdue
              ? "OVERDUE"
              : "DUE SOON",
          },
        ],
      }),
  
      text:
        `${isOverdue ? "MOC planned completion overdue" : "MOC planned completion approaching"}\n\n` +
        `MOC: ${input.mocTitle}\n` +
        `Reference: ${input.mocReference}\n` +
        `Current status: ${formatEnumValue(input.mocStatus)}\n` +
        `Site: ${getSiteValue(input.siteName)}\n` +
        `Planned completion: ${formatDateTime(input.plannedCompletionDate)}\n\n` +
        `Review: ${mocUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `MOC planned-completion SLA email failed for MOC ${input.mocId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendMocVerificationSlaEmail(
    input: MocVerificationSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const mocUrl =
      `${applicationUrl}/moc/${input.mocId}`;
  
    const result = await sendEmail({
      to: input.recipientEmail,
  
      subject:
        `MOC verification overdue: ${input.mocReference}`,
  
      html: createSenzilyticsEmailTemplate({
        preheader:
          "A Management of Change request remains in verification beyond its planned completion date.",
  
        heading:
          "MOC verification is overdue",
  
        body:
          `Hello ${input.recipientName},\n\n` +
          "The Management of Change request below remains in the verification stage beyond its planned completion date. Review the implementation evidence, outstanding verification requirements, residual risk, and closure readiness.",
  
        actionLabel:
          "Review MOC Verification",
  
        actionUrl:
          mocUrl,
  
        details: [
          {
            label: "MOC",
            value:
              input.mocTitle,
          },
          {
            label: "Reference",
            value:
              input.mocReference,
          },
          {
            label: "Site",
            value:
              getSiteValue(
                input.siteName
              ),
          },
          {
            label: "Planned completion",
            value:
              formatDateTime(
                input.plannedCompletionDate
              ),
          },
          {
            label: "Current stage",
            value:
              "VERIFICATION",
          },
          {
            label: "Status",
            value:
              "OVERDUE",
          },
        ],
      }),
  
      text:
        `MOC verification overdue\n\n` +
        `MOC: ${input.mocTitle}\n` +
        `Reference: ${input.mocReference}\n` +
        `Site: ${getSiteValue(input.siteName)}\n` +
        `Planned completion: ${formatDateTime(input.plannedCompletionDate)}\n` +
        `Current stage: Verification\n\n` +
        `Review: ${mocUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `MOC verification SLA email failed for MOC ${input.mocId}:`,
        result.error
      );
    }
  
    return result;
  }
