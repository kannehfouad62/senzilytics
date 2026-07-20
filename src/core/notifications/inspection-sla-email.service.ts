import {
    getApplicationUrl,
    sendTenantNotificationEmail as sendEmail,
  } from "@/core/email/email.service";
  import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
  
  type InspectionSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
    inspectionId: string;
    inspectionTitle: string;
    inspectionReference?: string | null;
    inspectionType: string;
    inspectionArea?: string | null;
    siteName: string;
    dueDate: Date;
    notificationKind:
      | "REMINDER"
      | "OVERDUE";
  };
  
  type InspectionFindingSlaEmailInput = {
    recipientEmail: string;
    recipientName: string;
    inspectionId: string;
    inspectionTitle: string;
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
  
  export async function sendInspectionSlaEmail(
    input: InspectionSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const inspectionUrl =
      `${applicationUrl}/inspections/${input.inspectionId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result =
      await sendEmail({
        to: input.recipientEmail,
  
        subject: isOverdue
          ? `Inspection overdue: ${input.inspectionTitle}`
          : `Inspection due soon: ${input.inspectionTitle}`,
  
        html:
          createSenzilyticsEmailTemplate({
            preheader: isOverdue
              ? "An assigned inspection is overdue."
              : "An assigned inspection is due within 24 hours.",
  
            heading: isOverdue
              ? "Inspection is overdue"
              : "Inspection is due soon",
  
            body:
              `Hello ${input.recipientName},\n\n` +
              (isOverdue
                ? "An inspection assigned to you has passed its completion due date. Please review its status and complete the remaining field work."
                : "An inspection assigned to you is due within the next 24 hours. Please complete the remaining field work before the deadline."),
  
            actionLabel:
              "Review Inspection",
  
            actionUrl:
              inspectionUrl,
  
            details: [
              {
                label: "Inspection",
                value:
                  input.inspectionTitle,
              },
              {
                label: "Reference",
                value:
                  input.inspectionReference ||
                  "No reference",
              },
              {
                label:
                  "Inspection type",
                value:
                  formatEnumValue(
                    input.inspectionType
                  ),
              },
              {
                label: "Area",
                value:
                  input.inspectionArea ||
                  "Not specified",
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
          `${
            isOverdue
              ? "Inspection overdue"
              : "Inspection due soon"
          }\n\n` +
          `Inspection: ${input.inspectionTitle}\n` +
          `Reference: ${input.inspectionReference || "No reference"}\n` +
          `Inspection type: ${formatEnumValue(input.inspectionType)}\n` +
          `Area: ${input.inspectionArea || "Not specified"}\n` +
          `Site: ${input.siteName}\n` +
          `Due date: ${formatDateTime(input.dueDate)}\n\n` +
          `Review: ${inspectionUrl}`,
      });
  
    if (!result.success) {
      console.error(
        `Inspection SLA email failed for inspection ${input.inspectionId}:`,
        result.error
      );
    }
  
    return result;
  }
  
  export async function sendInspectionFindingSlaEmail(
    input: InspectionFindingSlaEmailInput
  ) {
    const applicationUrl =
      getApplicationUrl();
  
    const inspectionUrl =
      `${applicationUrl}/inspections/${input.inspectionId}`;
  
    const isOverdue =
      input.notificationKind ===
      "OVERDUE";
  
    const result =
      await sendEmail({
        to: input.recipientEmail,
  
        subject: isOverdue
          ? `Inspection finding overdue: ${input.findingTitle}`
          : `Inspection finding due soon: ${input.findingTitle}`,
  
        html:
          createSenzilyticsEmailTemplate({
            preheader: isOverdue
              ? "An inspection finding is overdue."
              : "An inspection finding is due within 24 hours.",
  
            heading: isOverdue
              ? "Inspection finding is overdue"
              : "Inspection finding is due soon",
  
            body:
              `Hello ${input.recipientName},\n\n` +
              (isOverdue
                ? "An unresolved inspection finding has passed its due date and requires immediate attention."
                : "An unresolved inspection finding is due within the next 24 hours."),
  
            actionLabel:
              "Review Inspection Finding",
  
            actionUrl:
              inspectionUrl,
  
            details: [
              {
                label: "Inspection",
                value:
                  input.inspectionTitle,
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
          `${
            isOverdue
              ? "Inspection finding overdue"
              : "Inspection finding due soon"
          }\n\n` +
          `Inspection: ${input.inspectionTitle}\n` +
          `Finding: ${input.findingTitle}\n` +
          `Risk level: ${formatEnumValue(input.riskLevel)}\n` +
          `Site: ${input.siteName}\n` +
          `Due date: ${formatDateTime(input.dueDate)}\n\n` +
          `Review: ${inspectionUrl}`,
      });
  
    if (!result.success) {
      console.error(
        `Inspection-finding SLA email failed for finding ${input.findingId}:`,
        result.error
      );
    }
  
    return result;
  }
