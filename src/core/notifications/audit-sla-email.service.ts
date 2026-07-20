import {
    getApplicationUrl,
    sendTenantNotificationEmail as sendEmail,
  } from "@/core/email/email.service";
  import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
  
  type AuditSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
    auditId: string;
    auditTitle: string;
    auditReference?: string | null;
    auditType: string;
    siteName: string;
    dueDate: Date;
    notificationKind:
      | "REMINDER"
      | "OVERDUE";
  };
  
  type AuditFindingSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
    auditId: string;
    auditTitle: string;
    findingId: string;
    findingTitle: string;
    findingDescription?: string | null;
    riskLevel: string;
    siteName: string;
    dueDate: Date;
    notificationKind:
      | "REMINDER"
      | "OVERDUE";
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
  
  function formatEnumValue(
    value: string
  ) {
    return value.replaceAll(
      "_",
      " "
    );
  }
  
  export async function sendAuditSlaEmail(
    input: AuditSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const auditUrl =
      `${applicationUrl}/audits/${input.auditId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result = await sendEmail({
      to: input.recipientEmail,
      subject: isOverdue
        ? `Audit overdue: ${input.auditTitle}`
        : `Audit due soon: ${input.auditTitle}`,
      html: createSenzilyticsEmailTemplate({
        preheader: isOverdue
          ? "An assigned audit is overdue."
          : "An assigned audit is due within 24 hours.",
        heading: isOverdue
          ? "Audit is overdue"
          : "Audit is due soon",
        body:
          `Hello ${input.recipientName},\n\n` +
          (isOverdue
            ? "An audit assigned to you has passed its completion due date. Please review its status and complete the remaining work."
            : "An audit assigned to you is due within the next 24 hours. Please review its progress and complete the remaining work before the deadline."),
        actionLabel:
          "Review Audit",
        actionUrl: auditUrl,
        details: [
          {
            label: "Audit",
            value:
              input.auditTitle,
          },
          {
            label: "Reference",
            value:
              input.auditReference ||
              "No reference",
          },
          {
            label: "Audit type",
            value:
              formatEnumValue(
                input.auditType
              ),
          },
          {
            label: "Site",
            value:
              input.siteName,
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
        `${isOverdue ? "Audit overdue" : "Audit due soon"}\n\n` +
        `Audit: ${input.auditTitle}\n` +
        `Reference: ${input.auditReference || "No reference"}\n` +
        `Audit type: ${formatEnumValue(input.auditType)}\n` +
        `Site: ${input.siteName}\n` +
        `Due date: ${formatDateTime(input.dueDate)}\n\n` +
        `Review: ${auditUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `Audit SLA email failed for audit ${input.auditId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendAuditFindingSlaEmail(
    input: AuditFindingSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const auditUrl =
      `${applicationUrl}/audits/${input.auditId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result = await sendEmail({
      to: input.recipientEmail,
      subject: isOverdue
        ? `Audit finding overdue: ${input.findingTitle}`
        : `Audit finding due soon: ${input.findingTitle}`,
      html: createSenzilyticsEmailTemplate({
        preheader: isOverdue
          ? "An audit finding is overdue."
          : "An audit finding is due within 24 hours.",
        heading: isOverdue
          ? "Audit finding is overdue"
          : "Audit finding is due soon",
        body:
          `Hello ${input.recipientName},\n\n` +
          (isOverdue
            ? "An unresolved audit finding has passed its due date and requires management attention."
            : "An unresolved audit finding is due within the next 24 hours."),
        actionLabel:
          "Review Audit Finding",
        actionUrl: auditUrl,
        details: [
          {
            label: "Audit",
            value:
              input.auditTitle,
          },
          {
            label: "Finding",
            value:
              input.findingTitle,
          },
          {
            label: "Description",
            value:
              input.findingDescription ||
              "No description provided.",
          },
          {
            label: "Risk level",
            value:
              formatEnumValue(
                input.riskLevel
              ),
          },
          {
            label: "Site",
            value:
              input.siteName,
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
        `${isOverdue ? "Audit finding overdue" : "Audit finding due soon"}\n\n` +
        `Audit: ${input.auditTitle}\n` +
        `Finding: ${input.findingTitle}\n` +
        `Risk level: ${formatEnumValue(input.riskLevel)}\n` +
        `Site: ${input.siteName}\n` +
        `Due date: ${formatDateTime(input.dueDate)}\n\n` +
        `Review: ${auditUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `Audit-finding SLA email failed for finding ${input.findingId}:`,
        result.error
      );
    }
  
    return result;
  }
