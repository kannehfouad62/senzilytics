import {
    getApplicationUrl,
    sendTenantNotificationEmail as sendEmail,
  } from "@/core/email/email.service";
  import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
  import { RiskLevel } from "@prisma/client";
  
  type IncidentEscalationEmailInput = {
    recipientEmail: string;
    recipientName: string;
    incidentId: string;
    incidentTitle: string;
    incidentDescription: string;
    incidentType: string;
    riskLevel: RiskLevel;
    status: string;
    escalationLevel: number;
    siteName: string;
    location?: string | null;
    occurredAt: Date;
    reportedAt: Date;
    reportedByName: string;
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
  
  function getEscalationHeading(input: {
    riskLevel: RiskLevel;
    escalationLevel: number;
  }) {
    if (input.riskLevel === RiskLevel.CRITICAL) {
      return input.escalationLevel >= 3
        ? "Critical incident requires executive attention"
        : "Critical incident remains unresolved";
    }
  
    return input.escalationLevel >= 3
      ? "High-risk incident requires immediate management action"
      : "High-risk incident remains unresolved";
  }
  
  function getEscalationBody(input: {
    recipientName: string;
    riskLevel: RiskLevel;
    escalationLevel: number;
  }) {
    const urgency =
      input.escalationLevel >= 3
        ? "Immediate management intervention is required."
        : "Please review the incident, confirm that appropriate controls are in place, and ensure the investigation is progressing.";
  
    return (
      `Hello ${input.recipientName},\n\n` +
      `An unresolved ${formatEnumValue(
        input.riskLevel
      ).toLowerCase()} incident has reached escalation level ${input.escalationLevel}. ` +
      urgency
    );
  }
  
  export async function sendIncidentEscalationEmail(
    input: IncidentEscalationEmailInput
  ) {
    const applicationUrl = getApplicationUrl();
    const incidentUrl =
      `${applicationUrl}/incidents/${input.incidentId}`;
  
    const heading = getEscalationHeading({
      riskLevel: input.riskLevel,
      escalationLevel: input.escalationLevel,
    });
  
    const result = await sendEmail({
      to: input.recipientEmail,
      subject:
        `[Escalation ${input.escalationLevel}] ` +
        `${formatEnumValue(input.riskLevel)} incident: ` +
        input.incidentTitle,
      html: createSenzilyticsEmailTemplate({
        preheader:
          `An unresolved ${formatEnumValue(
            input.riskLevel
          ).toLowerCase()} incident has reached escalation level ` +
          `${input.escalationLevel}.`,
        heading,
        body: getEscalationBody({
          recipientName: input.recipientName,
          riskLevel: input.riskLevel,
          escalationLevel: input.escalationLevel,
        }),
        actionLabel: "Review Escalated Incident",
        actionUrl: incidentUrl,
        details: [
          {
            label: "Escalation level",
            value: String(input.escalationLevel),
          },
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
            label: "Current status",
            value: formatEnumValue(input.status),
          },
          {
            label: "Site",
            value: input.siteName,
          },
          {
            label: "Location",
            value:
              input.location ||
              "No location was provided.",
          },
          {
            label: "Occurred",
            value: formatDateTime(input.occurredAt),
          },
          {
            label: "Reported",
            value: formatDateTime(input.reportedAt),
          },
          {
            label: "Reported by",
            value: input.reportedByName,
          },
        ],
      }),
      text:
        `${heading}\n\n` +
        `Escalation level: ${input.escalationLevel}\n` +
        `Incident: ${input.incidentTitle}\n` +
        `Description: ${input.incidentDescription}\n` +
        `Type: ${formatEnumValue(input.incidentType)}\n` +
        `Risk level: ${formatEnumValue(input.riskLevel)}\n` +
        `Status: ${formatEnumValue(input.status)}\n` +
        `Site: ${input.siteName}\n` +
        `Location: ${input.location || "Not provided"}\n` +
        `Occurred: ${formatDateTime(input.occurredAt)}\n` +
        `Reported: ${formatDateTime(input.reportedAt)}\n` +
        `Reported by: ${input.reportedByName}\n\n` +
        `Review the incident: ${incidentUrl}`,
    });
  
    if (!result.success) {
      console.error(
        `Incident escalation email failed for incident ${input.incidentId}:`,
        result.error
      );
    }
  
    return result;
  }
