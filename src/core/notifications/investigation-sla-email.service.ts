import {
    getApplicationUrl,
    sendEmail,
  } from "@/core/email/email.service";
  import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
  
  type InvestigationSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
    investigationId: string;
    incidentId: string;
    incidentTitle: string;
    incidentType: string;
    incidentRiskLevel: string;
    siteName: string;
    dueDate: Date;
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
  
  export async function sendInvestigationSlaEmail(
    input: InvestigationSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const incidentUrl =
      `${applicationUrl}/incidents/${input.incidentId}`;
  
    const isOverdue =
      input.notificationKind === "OVERDUE";
  
    const result = await sendEmail({
      to: input.recipientEmail,
      subject: isOverdue
        ? `Investigation overdue: ${input.incidentTitle}`
        : `Investigation due soon: ${input.incidentTitle}`,
      html: createSenzilyticsEmailTemplate({
        preheader: isOverdue
          ? "An incident investigation assigned to you is overdue."
          : "An incident investigation assigned to you is due within 24 hours.",
        heading: isOverdue
          ? "Incident investigation is overdue"
          : "Incident investigation is due soon",
        body:
          `Hello ${input.recipientName},\n\n` +
          (isOverdue
            ? "An incident investigation assigned to you has passed its due date. Please review the investigation and complete the required analysis as soon as possible."
            : "An incident investigation assigned to you is due within the next 24 hours. Please review the investigation and complete the required analysis before the deadline."),
        actionLabel:
          "Review Investigation",
        actionUrl: incidentUrl,
        details: [
          {
            label: "Incident",
            value: input.incidentTitle,
          },
          {
            label: "Incident type",
            value: formatEnumValue(
              input.incidentType
            ),
          },
          {
            label: "Risk level",
            value: formatEnumValue(
              input.incidentRiskLevel
            ),
          },
          {
            label: "Site",
            value: input.siteName,
          },
          {
            label: "Due date",
            value: formatDateTime(
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
        `${
          isOverdue
            ? "Incident investigation overdue"
            : "Incident investigation due soon"
        }\n\n` +
        `Incident: ${input.incidentTitle}\n` +
        `Incident type: ${formatEnumValue(
          input.incidentType
        )}\n` +
        `Risk level: ${formatEnumValue(
          input.incidentRiskLevel
        )}\n` +
        `Site: ${input.siteName}\n` +
        `Due date: ${formatDateTime(
          input.dueDate
        )}\n\n` +
        `Review: ${incidentUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `Investigation SLA email failed for investigation ${input.investigationId}:`,
        result.error
      );
    }
  
    return result;
  }